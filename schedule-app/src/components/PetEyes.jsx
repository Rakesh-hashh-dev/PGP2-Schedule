import { useId } from 'react';
import { eyeContour, petFace } from '../lib/petFaces.js';

// Sockets and lids stay attached to the face; only clipped pupils track gaze.
export default function PetEyes({ pet, left, right, y, rx = 2, ry = rx, ink = '#252333', iris = '#ae8060', sclera, angle, digital = false, square = false }) {
  const id = 'eyes' + useId().replace(/\W/g, '');
  const face = petFace(pet);
  const width = rx * face.width;
  const height = ry * face.height;
  const tilt = angle ?? face.tilt;
  return <g className="dg-pet-eyes" data-part="eyes" data-eye-personality={pet} data-eye-shape={face.shape}>
    {[left, right].map((x, index) => {
      const clip = `${id}-${index}`;
      const contour = eyeContour(x, y, width, height, face.shape);
      const display = digital || face.shape === 'display';
      const socket = square || display
        ? <rect x={x - width} y={y - height} width={width * 2} height={height * 2} rx={width * (square ? .55 : .8)} />
        : <path d={contour} />;
      return <g key={index} className={`dg-pet-eye dg-pet-eye-${index ? 'right' : 'left'}`} transform={tilt ? `rotate(${index ? -tilt : tilt} ${x} ${y})` : undefined}>
        <defs><clipPath id={clip} clipPathUnits="userSpaceOnUse">{socket}</clipPath></defs>
        <g fill={sclera || ink} stroke={display ? iris : ink} strokeWidth=".28">{socket}</g>
        <g clipPath={`url(#${clip})`}>
          <ellipse cx={x} cy={y + height * .16} rx={width * .92} ry={height * .94} fill={iris} />
          <ellipse cx={x} cy={y + height * .63} rx={width * .72} ry={height * .23} fill={display ? '#b9fff1' : '#ffe3b0'} opacity={display ? .28 : .3} />
          <g className="dg-pet-pupils" data-part="pupils">
            <ellipse cx={x} cy={y - height * .03} rx={width * face.pupil} ry={height * .79} fill={ink} />
            {face.sparkle === 'pixel'
              ? <><rect x={x - width * .52} y={y - height * .58} width={width * .46} height={height * .33} rx=".08" fill="#e4fff9" /><path d={`M${x + width * .2} ${y + height * .38}h${width * .3}`} stroke={iris} strokeWidth=".3" /></>
              : <>
                <ellipse cx={x - width * .3} cy={y - height * .41} rx={width * .29} ry={height * .23} fill="#fffdf6" />
                <ellipse cx={x + width * .36} cy={y + height * .32} rx={width * .13} ry={height * .12} fill="#fff6e9" opacity=".85" />
                {face.sparkle === 'star' && <path d={`M${x + width * .43} ${y - height * .45}v${height * .3}m${-width * .16} ${-height * .15}h${width * .32}`} stroke="#fffdf6" strokeWidth=".16" strokeLinecap="round" />}
              </>}
          </g>
        </g>
        {!display && <path className="dg-pet-eyelid" data-part="eyelids" d={face.shape === 'cozy'
          ? `M${x - width * .94} ${y - height * .16}Q${x} ${y - height * .78} ${x + width * .94} ${y - height * .16}`
          : `M${x - width * .87} ${y - height * .45}Q${x} ${y - height * 1.28} ${x + width * .87} ${y - height * .45}`} fill="none" stroke={ink} strokeWidth=".36" strokeLinecap="round" />}
      </g>;
    })}
  </g>;
}
