// GERADO por brand/relogio/gerar-logo.py — não editar à mão (logo-mark.test.ts confere).
import { Circle, Line, Polygon, Svg } from "@react-pdf/renderer";

export function PdfLogoMark({ size }: { size: number }) {
  return (
    <Svg viewBox="-125 -125 250 250" style={{ width: size, height: size }}>
      <Circle cx="0" cy="0" r="125.0" fill="#0e2e47"/>
      <Circle cx="0" cy="0" r="117" fill="none" stroke="#479bbf" strokeWidth="16"/>
      <Line x1="39.00" y1="-67.55" x2="50.50" y2="-87.47" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="67.55" y1="-39.00" x2="87.47" y2="-50.50" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="78.00" y1="-0.00" x2="101.00" y2="-0.00" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="67.55" y1="39.00" x2="87.47" y2="50.50" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="39.00" y1="67.55" x2="50.50" y2="87.47" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="0.00" y1="78.00" x2="0.00" y2="101.00" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="-39.00" y1="67.55" x2="-50.50" y2="87.47" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="-67.55" y1="39.00" x2="-87.47" y2="50.50" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="-78.00" y1="0.00" x2="-101.00" y2="0.00" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="-67.55" y1="-39.00" x2="-87.47" y2="-50.50" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Line x1="-39.00" y1="-67.55" x2="-50.50" y2="-87.47" stroke="#ffffff" strokeWidth="9" strokeLinecap="butt"/>
      <Polygon points="-14,-106 14,-106 0,-78" fill="#e6232f"/>
      <Polygon points="-6.00,18.00 -6.00,-42.00 0.00,-48.00 6.00,-42.00 6.00,12.60" fill="#ffffff" transform="rotate(304)"/>
      <Polygon points="-5.00,22.00 -5.00,-77.00 0.00,-86.00 5.00,-77.00 5.00,17.50" fill="#ffffff" transform="rotate(48)"/>
      <Circle cx="0" cy="0" r="11.5" fill="#0e2e47"/>
      <Polygon points="-1.4,-76 1.4,-76 2.6,0 3.0,18 0,34 -3.0,18 -2.6,0" fill="#e6232f"/>
      <Circle cx="0" cy="0" r="8" fill="#e6232f"/>
    </Svg>
  );
}
