const transformLinks = (links) => {
  const sortOrder = (a, b) => {
    return a.order - b.order;
  };

  const linkedMapSet = links
    .map((linkSet) => {
      return {
        href: linkSet.attributes.href,
        label: linkSet.attributes.label,
        isButton: linkSet.attributes.isButton,
        highlightText: linkSet.attributes.highlightText || null,
        order: linkSet.attributes.order,
        target: linkSet.attributes.target,
        links: linkSet.attributes.links
          .map((link) => {
            return {
              label: link.label,
              href: link.href,
              highlight: link.isHighlight,
              icon: link.icon?.data?.attributes || null,
              target: link.target,
            };
          })
          .sort(sortOrder),
      };
    })
    .sort(sortOrder);

  return linkedMapSet;
};

export default transformLinks;
