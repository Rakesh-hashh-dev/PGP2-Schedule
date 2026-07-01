# Claude Implementation Task: Premium Hero Backdrop

## Objective

Implement a premium animated hero backdrop similar to modern products
like Linear, Raycast, Arc, and Vercel.

### Design Goals

-   Minimalistic and elegant
-   Dark graphite background
-   Soft purple glow
-   Animated flowing SVG curves
-   High performance (CSS + SVG only)
-   No canvas or WebGL
-   Responsive

------------------------------------------------------------------------

# Structure

``` tsx
<div className="hero-card">
  <div className="hero-glow" />

  <svg
    className="hero-lines"
    viewBox="0 0 600 300"
    preserveAspectRatio="none"
  >
    <path
      d="M240 260 C330 170 420 180 600 70"
      className="line line1"
    />

    <path
      d="M200 270 C340 190 450 215 600 120"
      className="line line2"
    />

    <path
      d="M280 285 C420 230 520 250 600 180"
      className="line line3"
    />
  </svg>

  <!-- Existing page content -->
</div>
```

------------------------------------------------------------------------

# Background

``` css
.hero-card{
position:relative;
overflow:hidden;

background:
radial-gradient(circle at top right,
rgba(124,58,237,.18),
transparent 45%),
linear-gradient(
135deg,
#10121f 0%,
#14172a 55%,
#17142c 100%
);

border-radius:24px;
}
```

------------------------------------------------------------------------

# Glow

``` css
.hero-glow{

position:absolute;

right:-180px;
top:-180px;

width:450px;
height:450px;

background:
radial-gradient(circle,
rgba(124,58,237,.35),
transparent 72%);

filter:blur(55px);

pointer-events:none;
}
```

------------------------------------------------------------------------

# SVG

``` css
.hero-lines{
position:absolute;
inset:0;
width:100%;
height:100%;
}

.line{
fill:none;
stroke-linecap:round;
}
```

------------------------------------------------------------------------

# Line Styling

``` css
.line1{
stroke:#7C3AED;
stroke-width:2.5;
opacity:.45;
filter:drop-shadow(0 0 12px rgba(124,58,237,.7));
}

.line2{
stroke:#8B5CF6;
stroke-width:1.8;
opacity:.25;
filter:drop-shadow(0 0 10px rgba(139,92,246,.45));
}

.line3{
stroke:#6D28D9;
stroke-width:1.3;
opacity:.18;
filter:drop-shadow(0 0 8px rgba(124,58,237,.35));
}
```

------------------------------------------------------------------------

# Animation

``` css
.line{
stroke-dasharray:1200;
stroke-dashoffset:1200;
animation:draw 8s ease infinite;
}

@keyframes draw{
0%{stroke-dashoffset:1200;}
35%{stroke-dashoffset:0;}
100%{stroke-dashoffset:-1200;}
}
```

------------------------------------------------------------------------

# Optional Noise

``` css
.hero-card::after{
content:"";
position:absolute;
inset:0;
background-image:
radial-gradient(circle,
rgba(255,255,255,.18) 1px,
transparent 1px);
background-size:120px 120px;
opacity:.12;
pointer-events:none;
}
```

------------------------------------------------------------------------

# Layer Order

1.  Linear background gradient
2.  Radial glow
3.  Animated SVG curves
4.  Soft blurred purple glow
5.  Optional noise texture
6.  Existing UI content

------------------------------------------------------------------------

# Tailwind Notes

-   Keep content above backdrop with `relative z-10`.
-   Backdrop layers should use `absolute inset-0`.
-   Use `pointer-events-none` for decorative layers.
-   Respect the parent's `rounded-2xl` or `rounded-3xl` with
    `overflow-hidden`.

------------------------------------------------------------------------

# Color Palette

  Purpose                Color
  ---------------------- -----------------------
  Background             #0B1020
  Secondary Background   #111827
  Accent Purple          #7C3AED
  Soft Purple            #A855F7
  Highlight              #C084FC
  Cyan Accent            #22D3EE
  Border                 rgba(255,255,255,.08)

------------------------------------------------------------------------

# Acceptance Criteria

-   Smooth 60fps animation.
-   Responsive at all screen sizes.
-   No canvas/WebGL dependencies.
-   Decorative only (does not interfere with UI).
-   Matches premium SaaS aesthetics (Linear, Arc, Vercel).
