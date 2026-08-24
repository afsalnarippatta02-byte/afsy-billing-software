import React from 'react';

interface AfLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'black' | 'white' | 'inverted' | 'badge';
  withBorder?: boolean;
  name?: string;
}

export const AF_LOGO_IMAGE_URL = '';
export const AF_LOGO_SVG_DATA_URI = '';
export const AF_LOGO_DARK_SVG_DATA_URI = '';

export const AfLogo: React.FC<AfLogoProps> = ({ 
  className = '', 
  size = 40, 
  variant = 'black',
  withBorder = false,
  name = 'AFSY'
}) => {
  const dimensionStyle = {
    width: typeof size === 'number' ? `${size}px` : size,
    height: typeof size === 'number' ? `${size}px` : size,
  };

  // Extract up to 2-3 characters for monogram
  const cleanName = (name || 'AFSY').trim();
  const initials = cleanName.length <= 4 
    ? cleanName.toUpperCase()
    : cleanName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'AF';

  const isDark = variant === 'black';
  const isWhite = variant === 'white';

  return (
    <div 
      style={dimensionStyle} 
      className={`relative inline-flex items-center justify-center flex-shrink-0 font-black rounded-2xl select-none transition-all ${
        isDark 
          ? 'bg-slate-900 text-white shadow-md' 
          : isWhite 
          ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
          : 'bg-indigo-600 text-white shadow-md'
      } ${withBorder ? 'border border-slate-200 dark:border-slate-700' : ''} ${className}`}
    >
      <span className="text-[40%] font-black tracking-tight uppercase leading-none font-mono">
        {initials}
      </span>
    </div>
  );
};

export default AfLogo;



