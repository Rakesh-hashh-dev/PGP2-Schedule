import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect} from "vitest";
import FullSchedulePage from "./FullSchedulePage.jsx";
const cancelled={date:"2026-10-13",code:"SOM",section:"A",name:"Service Operations Management",session:"8",start:"14:30",end:"16:00",type:"cancelled",room:"A02"};
const active={...cancelled,code:"DM",name:"Digital Marketing",type:"class",start:"16:30",end:"18:00"};
const render=rows=>renderToStaticMarkup(<FullSchedulePage allClasses={rows} enrolled={{SOM:"A",DM:"A"}} legend={{SOM:{name:cancelled.name},DM:{name:active.name}}} termLabel="Term V" onOpenCourse={()=>{}}/>);
describe("full schedule cancellation display",()=>{
 it("keeps a shown cancellation alongside active classes and disables its course action",()=>{
  const html=render([cancelled,active]);
  expect(html).toContain("fs-card fs-card-cancelled");
  expect(html).toContain(cancelled.name);
  expect(html).toContain("Course hub unavailable: class cancelled");
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Course hub unavailable: class cancelled"/);
  expect(html).toContain("Open course hub for DM");
  expect(html).toContain("1 sessions");
 });
 it("keeps a day whose only class is cancelled",()=>{
  const html=render([cancelled]);
  expect(html).toContain("day-2026-10-13");
  expect(html).toContain("fs-card fs-card-cancelled");
  expect(html).toContain("0 sessions");
 });
});
