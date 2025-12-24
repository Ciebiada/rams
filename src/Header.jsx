import "./Header.css";
export const Header = (props) => {
    return <header class="header">{props.children}</header>;
};
export const HeaderButton = (props) => (<button class="header-button" classList={{ "header-button-primary": props.primary, "header-right": props.right }} onClick={props.onClick}>
    {props.children}
  </button>);
