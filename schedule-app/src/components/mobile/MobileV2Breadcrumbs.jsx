import { ArrowLeft, ChevronRight } from "lucide-react";
import { v2BreadcrumbItems } from "../../lib/v2Breadcrumbs.js";

export default function MobileV2Breadcrumbs(props) {
  const items = v2BreadcrumbItems(props);
  if (!items.length) return null;
  const parent = items.at(-2);
  return (
    <nav className="mobile-v2-breadcrumbs" aria-label="Breadcrumb">
      {parent.onSelect && <button type="button" className="mobile-v2-breadcrumb-back" onClick={parent.onSelect} aria-label={"Back to " + parent.label}>
        <ArrowLeft size={16} aria-hidden="true" /><span>{parent.label}</span>
      </button>}
      <ol>
        {items.map((item, index) => <li key={item.id}>
          {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
          {item.onSelect
            ? <button type="button" onClick={item.onSelect} title={item.label}>{item.label}</button>
            : <span aria-current={index === items.length - 1 ? "page" : undefined} title={item.label}>{item.label}</span>}
        </li>)}
      </ol>
    </nav>
  );
}
