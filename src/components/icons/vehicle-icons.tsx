import React from 'react';

export interface VehicleIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Articulated Semi-Truck / TIR Fleet Icon (الشاحنة الدولية المتكاملة - رأس ومقطورة معاً)
 * Designed specifically for international freight transport (European cabover tractor + TIR semi-trailer).
 * Features 3 balanced axles (trailer rear, tractor drive under coupling, tractor front steer)
 * with aerodynamic cab, windshield, and cargo box seams.
 */
export function ArticulatedTruckIcon({ size = 24, className = '', strokeWidth = 2, ...props }: VehicleIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Semi-Trailer Cargo Box (Frigo / Bâchée TIR) */}
      <path d="M1.5 6.5h11a1 1 0 0 1 1 1v8h-12a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" />
      <path d="M7 6.5v9" />
      {/* Fifth-wheel Coupling Link */}
      <path d="M13.5 14h1.5" />
      {/* Heavy European Cabover Tractor (Tall sleeper cab & aero roof) */}
      <path d="M15 15.5V8a1 1 0 0 1 1-1h2a1 1 0 0 1 .8.4l2.8 3.6a1 1 0 0 1 .4.6v3.9a1 1 0 0 1-1 1h-2" />
      {/* Aerodynamic Windshield */}
      <path d="M17.5 8l2.2 3.5H16" />
      {/* 3 Axles: Trailer Rear + Tractor Drive + Tractor Steer */}
      <circle cx="4.5" cy="18.5" r="2" />
      <circle cx="13.5" cy="18.5" r="2" />
      <circle cx="19.5" cy="18.5" r="2" />
    </svg>
  );
}

/**
 * Tractor Unit / Heavy Truck Head Icon (رأس الشاحنة القاطرة - Tracteur Routier)
 * Represents European heavy long-haul tractor units (Volvo FH, Renault T-High, Scania, Actros).
 * Features high sleeper cab, front horizontal grille, rear coupling plate (sellette), and drive axle.
 */
export function TractorIcon({ size = 24, className = '', strokeWidth = 2, ...props }: VehicleIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Rear Chassis Platform with Fifth-wheel Coupling (Sellette) */}
      <path d="M2 14h6v2H2" />
      <path d="M3.5 11.5h3" />
      <path d="M5 11.5v2.5" />
      {/* Heavy European Cabover Body (High Sleeper Cab) */}
      <path d="M8 14V5a1.5 1.5 0 0 1 1.5-1.5h5.8a1.5 1.5 0 0 1 1.3.8l3.6 5.2a1.5 1.5 0 0 1 .3.9V15a1.5 1.5 0 0 1-1.5 1.5H17" />
      {/* Windshield & Cabin Window */}
      <path d="M14.5 4.5l3.2 5H10V4.5" />
      {/* Front Calandre / Grille Bars */}
      <path d="M18.5 12h-3.5" />
      <path d="M18.5 14h-3.5" />
      {/* Rear Drive Axle & Front Steer Axle */}
      <circle cx="5.5" cy="18" r="2.5" />
      <circle cx="15.5" cy="18" r="2.5" />
    </svg>
  );
}

/**
 * Trailer Icon (المقطورة / نصف المقطورة - Semi-Remorque / Frigo / Bâchée)
 * Features refrigerated/curtainsider cargo box, front cooling unit, landing legs, and tandem axles.
 */
export function TrailerIcon({ size = 24, className = '', strokeWidth = 2, ...props }: VehicleIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Main Semi-Trailer Box */}
      <rect x="2" y="5" width="16" height="10.5" rx="1.5" />
      {/* Cargo Panel Seams */}
      <path d="M7.5 5v10.5" />
      <path d="M13 5v10.5" />
      {/* Front Refrigeration Unit (Groupe Frigo) */}
      <path d="M18 7.5h2a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-2" />
      {/* Landing Gear Support Legs (Béquilles) */}
      <path d="M14.5 15.5v3" />
      <path d="M13.5 18.5h2" />
      {/* Tandem Trailer Axles */}
      <circle cx="5.5" cy="18.5" r="2" />
      <circle cx="10" cy="18.5" r="2" />
    </svg>
  );
}

/**
 * Universal Truck Icon - default heavy international transport truck
 */
export const TruckIcon = ArticulatedTruckIcon;
export const Truck = ArticulatedTruckIcon;

/**
 * Aliases for ease of import across different conventions
 */
export const TruckHeadIcon = TractorIcon;
export const Tractor = TractorIcon;
export const SemiTrailerIcon = TrailerIcon;
export const RemorqueIcon = TrailerIcon;
export const Trailer = TrailerIcon;
export const FleetIcon = ArticulatedTruckIcon;
export const TirTruckIcon = ArticulatedTruckIcon;

/**
 * Dynamic Vehicle Icon based on entity type
 */
export function VehicleIcon({
  type,
  ...props
}: VehicleIconProps & { type?: 'truck' | 'trailer' | 'driver' | string }) {
  if (type === 'trailer') {
    return <TrailerIcon {...props} />;
  }
  if (type === 'truck') {
    return <TractorIcon {...props} />;
  }
  return <ArticulatedTruckIcon {...props} />;
}

