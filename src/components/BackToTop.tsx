"use client";

import { useState, useEffect } from "react";
import { FiArrowUp } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ 
            scale: 1, 
            opacity: 1, 
            y: 0,
            transition: { 
              type: "spring", 
              stiffness: 300, 
              damping: 20 
            }
          }}
          exit={{ 
            scale: 0, 
            opacity: 0, 
            y: 20,
            transition: { duration: 0.2 }
          }}
          className="fixed bottom-8 right-8 z-50"
        >
          <motion.button
            onClick={scrollToTop}
            className="
              relative flex items-center justify-center
              w-16 h-16 rounded-full
              bg-hospineil-primary
              shadow-lg
              border-2 border-hospineil-accent/20
              overflow-hidden
              cursor-pointer
            "
            whileHover={{ 
              scale: 1.15,
              y: -3,
              boxShadow: "0 10px 25px rgba(94, 184, 194, 0.4)",
              transition: { type: "spring", stiffness: 400, damping: 17 }
            }}
            whileTap={{ scale: 0.9 }}
            animate={{
              boxShadow: [
                "0 4px 14px rgba(94, 184, 194, 0.3)",
                "0 6px 20px rgba(94, 184, 194, 0.5)",
                "0 4px 14px rgba(94, 184, 194, 0.3)",
              ],
            }}
            transition={{
              boxShadow: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
          >
            {/* Animated background gradient */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-hospineil-primary via-hospineil-accent to-hospineil-primary"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
              style={{
                backgroundSize: "200% 200%",
              }}
            />
            {/* Arrow Icon with bounce animation */}
            <motion.div
              animate={{
                y: [0, -4, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <FiArrowUp className="relative z-10 text-white w-7 h-7" />
            </motion.div>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
