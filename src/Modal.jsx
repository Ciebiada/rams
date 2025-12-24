import { Portal } from "solid-js/web";
import { createContext, useContext, createSignal, createEffect, Show, onCleanup, batch, } from "solid-js";
import { BackIcon, CloseIcon, ChevronUpDownIcon } from "./Icons";
import "./Modal.css";
const MODAL_ANIMATION_DURATION = 400;
const MODAL_FAST_ANIMATION_DURATION = 100;
const ModalContext = createContext();
export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context)
        throw new Error("useModal must be used within a Modal");
    return context;
};
const useModalStack = (initialTitle) => {
    const [pageStack, setPageStack] = createSignal(["root"]);
    const [direction, setDirection] = createSignal(null);
    const [currentTitle, setCurrentTitle] = createSignal(initialTitle);
    const push = (pageId, title) => {
        setDirection("forward");
        setPageStack((prev) => [...prev, pageId]);
        if (title)
            setCurrentTitle(title);
    };
    const pop = () => {
        if (pageStack().length > 1) {
            setDirection("backward");
            setPageStack((prev) => prev.slice(0, -1));
            setCurrentTitle(initialTitle);
        }
    };
    const reset = (title) => {
        batch(() => {
            setPageStack(["root"]);
            setDirection(null);
            setCurrentTitle(title);
        });
    };
    const currentPage = () => pageStack()[pageStack().length - 1];
    const isRoot = () => pageStack().length === 1;
    return { pageStack, direction, currentTitle, push, pop, reset, currentPage, isRoot };
};
const createSheetDrag = (onClose) => {
    const [modalPosition, setModalPosition] = createSignal(window.innerHeight);
    const [dragOffsetY, setDragOffsetY] = createSignal(0);
    const [isDragging, setIsDragging] = createSignal(false);
    const [animationDuration, setAnimationDuration] = createSignal(MODAL_ANIMATION_DURATION);
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let prevY = 0;
    let prevTime = 0;
    const handleDragStart = (e) => {
        setIsDragging(true);
        const now = Date.now();
        lastTime = now;
        prevTime = now;
        if (e instanceof TouchEvent) {
            startY = e.touches[0].clientY;
            lastY = startY;
            prevY = startY;
            window.addEventListener("touchmove", handleDragMove, { passive: false });
            window.addEventListener("touchend", handleDragEnd);
        }
        else {
            startY = e.clientY;
            lastY = startY;
            prevY = startY;
            window.addEventListener("mousemove", handleDragMove);
            window.addEventListener("mouseup", handleDragEnd);
        }
    };
    const handleDragMove = (e) => {
        if (!isDragging())
            return;
        let clientY;
        if (e instanceof TouchEvent) {
            e.preventDefault();
            clientY = e.touches[0].clientY;
        }
        else {
            clientY = e.clientY;
        }
        const deltaY = clientY - startY;
        const now = Date.now();
        if (now > lastTime) {
            prevY = lastY;
            prevTime = lastTime;
            lastY = clientY;
            lastTime = now;
        }
        const potentialPosition = modalPosition() + deltaY;
        setDragOffsetY(potentialPosition < 0 ? -modalPosition() : deltaY);
    };
    const handleDragEnd = () => {
        const screenHeight = window.innerHeight;
        const currentPosition = modalPosition() + dragOffsetY();
        const dt = lastTime - prevTime;
        const velocity = dt > 0 ? (lastY - prevY) / dt : 0;
        const flickThreshold = 0.5;
        const isFlickUp = velocity < -flickThreshold;
        const isFlickDown = velocity > flickThreshold;
        const dismissThreshold = screenHeight * 0.75;
        const fullScreenThreshold = screenHeight * 0.25;
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
        window.removeEventListener("touchmove", handleDragMove);
        window.removeEventListener("touchend", handleDragEnd);
        batch(() => {
            setIsDragging(false);
            setAnimationDuration(MODAL_ANIMATION_DURATION);
            if (isFlickDown) {
                if (modalPosition() === 0)
                    setModalPosition(screenHeight * 0.5);
                else
                    onClose();
                setDragOffsetY(0);
            }
            else if (isFlickUp) {
                if (modalPosition() > 0)
                    setModalPosition(0);
                setDragOffsetY(0);
            }
            else if (currentPosition > dismissThreshold) {
                onClose();
            }
            else if (currentPosition < fullScreenThreshold) {
                setModalPosition(0);
                setDragOffsetY(0);
            }
            else {
                setModalPosition(screenHeight * 0.5);
                setDragOffsetY(0);
            }
        });
    };
    return {
        modalPosition,
        setModalPosition,
        dragOffsetY,
        setDragOffsetY,
        isDragging,
        setIsDragging,
        animationDuration,
        setAnimationDuration,
        handleDragStart,
    };
};
export const Modal = (props) => {
    const modalStack = useModalStack(props.title || "");
    const [isVisible, setIsVisible] = createSignal(false);
    const [isClosing, setIsClosing] = createSignal(false);
    const lockScroll = () => {
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
    };
    const unlockScroll = () => {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
    };
    const closeWithAnimation = async (fast) => {
        if (isClosing() || !isVisible())
            return;
        const duration = fast ? MODAL_FAST_ANIMATION_DURATION : MODAL_ANIMATION_DURATION;
        setIsClosing(true);
        batch(() => {
            sheet.setAnimationDuration(duration);
            sheet.setModalPosition(window.innerHeight);
            sheet.setDragOffsetY(0);
        });
        props.setOpen(false);
        await new Promise((resolve) => setTimeout(resolve, duration));
        batch(() => {
            modalStack.reset(props.title || "");
            setIsClosing(false);
            setIsVisible(false);
        });
        unlockScroll();
        props.onClose?.();
    };
    const sheet = createSheetDrag(() => closeWithAnimation());
    createEffect(() => {
        const isOpen = props.open();
        if (isOpen) {
            batch(() => {
                sheet.setAnimationDuration(MODAL_ANIMATION_DURATION);
                setIsVisible(true);
                setIsClosing(false);
                sheet.setDragOffsetY(0);
                sheet.setIsDragging(false);
                sheet.setModalPosition(window.innerHeight);
            });
            lockScroll();
            // Ensure the browser acknowledges the starting position before animating
            requestAnimationFrame(() => {
                sheet.setModalPosition(window.innerHeight * 0.5);
            });
        }
        else if (isVisible() && !isClosing()) {
            closeWithAnimation();
        }
    });
    const handleKeyDown = (e) => {
        if (e.key === "Escape" && props.open()) {
            closeWithAnimation();
        }
    };
    createEffect(() => {
        if (props.open()) {
            document.addEventListener("keydown", handleKeyDown);
            onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
        }
    });
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            closeWithAnimation();
        }
    };
    const preventTouchMove = (e) => e.preventDefault();
    return (<ModalContext.Provider value={{
            close: closeWithAnimation,
            push: modalStack.push,
            pop: modalStack.pop,
            currentPage: modalStack.currentPage,
            isRoot: modalStack.isRoot,
            direction: modalStack.direction,
        }}>
      <Show when={isVisible()}>
        <Portal>
          <div class="modal-overlay" data-expanded={props.open() && !isClosing() ? "" : undefined} data-closed={isClosing() ? "" : undefined} style={{ "--animation-duration": `${sheet.animationDuration()}ms` }} onClick={handleOverlayClick} ref={(el) => el.addEventListener("touchmove", preventTouchMove, { passive: false })}/>
          <div class="modal-positioner" onClick={handleOverlayClick}>
            <div class="modal-content" data-expanded={props.open() && !isClosing() ? "" : undefined} data-closed={isClosing() ? "" : undefined} style={{
            "--animation-duration": `${sheet.animationDuration()}ms`,
            "--modal-offset": `${sheet.modalPosition() + sheet.dragOffsetY()}px`,
            transform: `translateY(${sheet.modalPosition() + sheet.dragOffsetY()}px)`,
            transition: sheet.isDragging()
                ? "none"
                : `transform ${sheet.animationDuration()}ms cubic-bezier(0.36, 0.66, 0.04, 1)`,
        }} onClick={(e) => e.stopPropagation()}>
              <div class="modal-handle" onMouseDown={sheet.handleDragStart} onTouchStart={sheet.handleDragStart}/>
              <div class="modal-fixed-header" onMouseDown={sheet.handleDragStart} onTouchStart={sheet.handleDragStart}>
                <button class="header-button" onClick={() => (modalStack.isRoot() ? closeWithAnimation() : modalStack.pop())} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                  <span class="modal-icon" classList={{ "modal-icon-visible": modalStack.isRoot() }}>
                    <CloseIcon />
                  </span>
                  <span class="modal-icon" classList={{ "modal-icon-visible": !modalStack.isRoot() }}>
                    <BackIcon />
                  </span>
                </button>
                <h2 class="modal-fixed-title">{modalStack.currentTitle()}</h2>
              </div>
              <div class="modal-pages-container">{props.children}</div>
            </div>
          </div>
        </Portal>
      </Show>
    </ModalContext.Provider>);
};
export const ModalPage = (props) => {
    const { currentPage, direction } = useModal();
    return (<Show when={currentPage() === props.id}>
      <div class="modal-page" data-animate={direction()}>
        {props.children}
      </div>
    </Show>);
};
export const ModalButton = (props) => {
    const { close } = useModal();
    const handleClick = () => {
        props.onClick?.(close);
    };
    return (<button class="modal-button" classList={{ "modal-button-danger": props.danger, [props.class]: !!props.class }} onClick={handleClick} style={props.style}>
      {props.children}
    </button>);
};
export const ModalToggle = (props) => {
    return (<div class="modal-toggle">
      <span class="modal-toggle-label">{props.label}</span>
      <label class="modal-toggle-switch">
        <input type="checkbox" checked={props.checked()} onChange={(e) => props.onChange(e.currentTarget.checked)}/>
        <span class="modal-toggle-slider"></span>
      </label>
    </div>);
};
export const ModalSelect = (props) => {
    return (<div class="modal-select-wrapper">
      <div class="modal-button">
        <span>{props.label}</span>
        <div class="modal-select-content">
          <span class="modal-select-value">{props.displayValue ?? props.value}</span>
          <ChevronUpDownIcon />
        </div>
      </div>
      <select class="modal-native-select" value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
        {props.children}
      </select>
    </div>);
};
export const ModalSlider = (props) => {
    let sliderRef;
    const [isSliding, setIsSliding] = createSignal(false);
    const [startX, setStartX] = createSignal(0);
    const [startValue, setStartValue] = createSignal(0);
    const handlePointerDown = (e) => {
        setIsSliding(true);
        setStartX(e.clientX);
        setStartValue(props.value);
        sliderRef?.setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e) => {
        if (!isSliding() || !sliderRef)
            return;
        const deltaX = e.clientX - startX();
        const rect = sliderRef.getBoundingClientRect();
        const deltaValue = (deltaX / rect.width) * (props.max - props.min);
        const rawValue = startValue() + deltaValue;
        const steppedValue = Math.round(rawValue / (props.step ?? 1)) * (props.step ?? 1);
        const finalValue = Math.max(props.min, Math.min(props.max, steppedValue));
        if (finalValue !== props.value) {
            props.onChange(finalValue);
        }
    };
    const handlePointerUp = (e) => {
        setIsSliding(false);
        sliderRef?.releasePointerCapture(e.pointerId);
    };
    const percentage = () => ((props.value - props.min) / (props.max - props.min)) * 100;
    return (<div ref={sliderRef} class="modal-slider-wrapper modal-button" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} style={{
            "touch-action": "pan-y",
            "--slider-progress": `${percentage()}%`,
        }}>
      <span>{props.label}</span>
      <div class="modal-slider-content">
        <span class="modal-slider-value">{props.displayValue ?? props.value}</span>
      </div>
    </div>);
};
