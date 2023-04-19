interface Link {
  href: string;
  label: string;
  isButton: boolean;
  highlightText: null;
  order: number;
  target: "_blank" | "_self" | "_parent" | "_top";
  links: any[];
}

export default Link;
