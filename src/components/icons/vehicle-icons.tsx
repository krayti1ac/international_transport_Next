import React from 'react';

export interface VehicleIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Tractor Unit / Heavy Truck Icon (رأس الشاحنة القاطرة - Tracteur Routier)
 * Designed specifically for international road freight (European heavy cabover tractor).
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
      {/* Aerodynamic Cabover Body */}
      <path d="M10 16.5H4a1 1 0 0 1-1-1V14h5V4.8a1 1 0 0 1 .7-.95L15 2.5a1.5 1.5 0 0 1 1.8 1.1L18 8h2a2 2 0 0 1 2 2v6.5h-2" />
      {/* Windshield */}
      <path d="M14 5.5l1.6 3.5H11V5.5z" />
      {/* Front Grille & Headlight Accent */}
      <path d="M20 12h-3" />
      <path d="M20 14h-3" />
      {/* Fifth-wheel Coupling (Sellette d'attelage) */}
      <path d="M4 12h4" />
      <path d="M6 12v2" />
      {/* Chassis / Fuel Tank */}
      <path d="M9 16.5h3.5" />
      {/* Rear Wheel (Drive Axle) */}
      <circle cx="6.5" cy="18.5" r="2.5" />
      {/* Front Wheel (Steer Axle) */}
      <circle cx="17.5" cy="18.5" r="2.5" />
    </svg>
  );
}

/**
 * Trailer Icon (المقطورة / نصف المقطورة - Semi-Remorque / Frigo / Bâchée)
 * Features refrigerated/curtainsider cargo box, front cooling unit, landing legs, and rear tandem axles.
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
      {/* Main Cargo Box */}
      <rect x="2" y="4" width="17" height="11.5" rx="1.5" />
      {/* Cargo Ribs / Panel Seams */}
      <path d="M7.5 4v11.5" />
      <path d="M13 4v11.5" />
      {/* Front Refrigeration Unit (Groupe Frigorifique / Thermo King) */}
      <path d="M19 6.5h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2" />
      {/* Landing Gear Support Legs (Béquilles) */}
      <path d="M15.5 15.5v3" />
      <path d="M14.5 18.5h2.5" />
      {/* Rear Underrun Protection Bumper */}
      <path d="M2 15.5v2h2" />
      {/* Rear Tandem Wheels */}
      <circle cx="6" cy="18.5" r="2.5" />
      <circle cx="11" cy="18.5" r="2.5" />
    </svg>
  );
}

/**
 * Articulated Semi-Truck / TIR Fleet Icon (الشاحنة الدولية المتكاملة - رأس ومقطورة معاً)
 * Full road combination for international road freight (Tracteur + Semi-remorque TIR).
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
      {/* Trailer Body */}
      <rect x="1" y="6" width="11" height="9.5" rx="1" />
      <path d="M5 6v9.5" />
      <path d="M8.5 6v9.5" />
      {/* Coupling / Fifth-Wheel Link */}
      <path d="M12 14h2" />
      {/* Tractor Cab */}
      <path d="M14 15.5V9.5a1 1 0 0 1 .6-.9l2.8-1.2a1 1 0 0 1 1.2.5L20 10.5h1.5a1 1 0 0 1 1 1V15.5h-1.5" />
      {/* Cab Windshield */}
      <path d="M16.5 9.5l1.6 2h-3v-2z" />
      {/* Front Headlight Accent */}
      <path d="M21 13.5h-1" />
      {/* Trailer Tandem Wheels */}
      <circle cx="4" cy="18" r="2" />
      <circle cx="8" cy="18" r="2" />
      {/* Tractor Drive & Steer Wheels */}
      <circle cx="15" cy="18" r="2" />
      <circle cx="19.5" cy="18" r="2" />
    </svg>
  );
}

/**
 * Universal Truck Icon - default heavy transport truck
 */
export const TruckIcon = TractorIcon;

/**
 * Aliases for ease of import across different conventions
 */
export const TruckHeadIcon = TractorIcon;
export const SemiTrailerIcon = TrailerIcon;
export const RemorqueIcon = TrailerIcon;
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
    return <TruckIcon {...props} />;
  }
  return <ArticulatedTruckIcon {...props} />;
}
