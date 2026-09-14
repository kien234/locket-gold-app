import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface KawaiiBunnyProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  expression?: 'happy' | 'wink' | 'love' | 'surprised';
}

export const KawaiiBunny: React.FC<KawaiiBunnyProps> = ({
  size = 'md',
  interactive = true,
  expression = 'happy',
}) => {
  const [currentExpression, setCurrentExpression] = useState(expression);
  const [isBouncing, setIsBouncing] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-36 h-36',
    xl: 'w-48 h-48',
  };

  const handleClick = () => {
    if (!interactive) return;
    setIsBouncing(true);
    const expressions: ('happy' | 'wink' | 'love' | 'surprised')[] = ['happy', 'wink', 'love', 'surprised'];
    const nextExpr = expressions[(expressions.indexOf(currentExpression) + 1) % expressions.length];
    setCurrentExpression(nextExpr);
    setTimeout(() => setIsBouncing(false), 800);
  };

  return (
    <motion.div
      className={`relative cursor-pointer select-none ${sizeClasses[size]}`}
      onClick={handleClick}
      animate={
        isBouncing
          ? { scale: [1, 1.25, 0.9, 1.1, 1], rotate: [0, -10, 10, -5, 0] }
          : { y: [0, -8, 0] }
      }
      transition={
        isBouncing
          ? { duration: 0.6 }
          : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
      }
      whileHover={{ scale: 1.1 }}
    >
      {/* Visual Image with Fallback Interactive SVG */}
      <img
        src="/assets/mascot.png"
        alt="Kawaii Locket Bunny Mascot"
        className="w-full h-full object-contain filter drop-shadow-lg"
        onError={(e) => {
          // If image load fails, hide image element so SVG fallback shows
          (e.target as HTMLElement).style.display = 'none';
        }}
      />

      {/* Heart floating on top */}
      <motion.div
        className="absolute -top-2 -right-2 text-pink-500 text-xl"
        animate={{ scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        💖
      </motion.div>
    </motion.div>
  );
};
