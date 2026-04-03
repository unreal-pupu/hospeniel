"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function Hero() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  return (
    <section 
      id="home" 
      className="relative w-full max-w-7xl mx-auto min-h-[80vh] sm:min-h-[90vh] md:min-h-[100vh] flex flex-col lg:flex-row lg:items-center lg:justify-between items-center justify-center px-3 sm:px-6 md:px-12 lg:px-20 bg-white pb-8 sm:pb-12 md:pb-16 pt-20 sm:pt-16 md:pt-0 overflow-hidden rounded-2xl sm:rounded-3xl md:rounded-[56px] max-w-[100%]"
      style={{ 
        contain: 'layout style paint',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    >
      {/* Content */}
      <div className="relative z-20 flex flex-col items-start text-left max-w-4xl w-full h-full py-0 sm:py-4 md:py-0 lg:pr-10" style={{ willChange: 'auto' }}>
        {/* h1 */}
        <motion.h1
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? {} : { duration: 0.8 }}
          style={{ willChange: prefersReducedMotion ? 'auto' : 'transform, opacity' }}
          className="text-[clamp(1.65rem,5.5vw+0.6rem,4rem)] sm:text-5xl md:text-6xl lg:text-7xl font-header italic font-bold text-hospineil-primary leading-[1.15] sm:leading-tight mt-0 sm:mt-0 md:mt-12 mb-3 sm:mb-4 md:mb-4 break-words"
        >
          Discover{" "}
          <span className="text-hospineil-primary">Food</span>,{" "}
          <span className="text-hospineil-primary">
            Chefs & Sweet Treats
          </span>{" "}
          — All in One Place
        </motion.h1>

        {/* p text */}
        <motion.p
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? {} : { delay: 0.4, duration: 0.8 }}
          style={{ willChange: prefersReducedMotion ? 'auto' : 'transform, opacity' }}
          className="mt-2 sm:mt-3 md:mt-6 text-sm sm:text-base md:text-lg lg:text-xl text-[#333333] font-body max-w-2xl px-0 sm:px-0 break-words"
        >
          From local food vendors and professional chefs for hire, to creative
          bakers and delightful pastry vendors — our platform brings the best
          culinary experiences right to you.
        </motion.p>

        <motion.div
          className="mt-5 sm:mt-6 md:mt-10 flex justify-start mb-4 sm:mb-6 md:mb-10"
          initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8, y: 20 }}
          whileInView={prefersReducedMotion ? {} : { 
            opacity: 1, 
            scale: 1, 
            y: 0,
            transition: { 
              type: "spring", 
              stiffness: 200, 
              damping: 20,
              delay: 0.6
            } 
          }}
          viewport={{ once: true, margin: "-50px" }}
          animate={prefersReducedMotion ? { opacity: 1, scale: 1, y: 0 } : {}}
          style={{ willChange: prefersReducedMotion ? 'auto' : 'transform, opacity' }}
        >
          <motion.div
            whileHover={prefersReducedMotion ? {} : {
              scale: 1.08,
              y: -2,
              transition: { type: "spring", stiffness: 400, damping: 17 }
            }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          >
            <Link href="/register">
              <motion.div
                className="relative inline-block"
                initial={false}
                animate={prefersReducedMotion ? {} : {
                  boxShadow: [
                    "0 4px 14px 0 rgba(231, 111, 3, 0.4)",
                    "0 6px 20px 0 rgba(94, 184, 194, 0.5)",
                    "0 4px 14px 0 rgba(231, 111, 3, 0.4)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Button className="relative rounded-full px-6 sm:px-8 py-2.5 sm:py-3 bg-[#E76F03] text-[#EDE9EC] font-button font-medium text-sm sm:text-base shadow-lg hover:bg-hospineil-primary focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 flex items-center gap-2 overflow-hidden group">
                  {/* Shimmer effect overlay */}
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={prefersReducedMotion ? {} : {
                      x: "100%",
                      transition: { duration: 0.6, ease: "easeInOut" }
                    }}
                  />
                  {/* Button content */}
                  <span className="relative z-10 flex items-center gap-2">
                    Get Started
                    <motion.span
                      animate={prefersReducedMotion ? {} : {
                        x: [0, 4, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <FiArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.span>
                  </span>
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Glovo-inspired layered images (style/layout only) */}
      <div className="relative z-0 w-full max-w-full min-w-0 lg:w-1/2 flex items-center justify-center lg:justify-end mt-10 lg:mt-0 px-0">
        <div className="relative w-full max-w-md lg:max-w-lg h-[260px] sm:h-[380px] lg:h-[460px] overflow-hidden rounded-3xl sm:rounded-[40px] bg-white/40 mx-auto">
          <div
            className="absolute -left-6 -top-6 w-56 h-56 rounded-full bg-white/10 blur-2xl z-0"
            aria-hidden
          />
          <div
            className="absolute -right-6 -bottom-6 w-56 h-56 rounded-full bg-hospineil-primary/10 blur-2xl z-0"
            aria-hidden
          />

          <motion.div
            className="absolute left-0 top-10 w-[160px] h-[160px] sm:w-[190px] sm:h-[190px] rounded-3xl shadow-xl overflow-hidden z-10"
            initial={prefersReducedMotion ? {} : { y: 10, rotate: -2, scale: 0.99 }}
            whileInView={
              prefersReducedMotion
                ? {}
                : { y: [10, -10, 10], rotate: [-2, 2, -2], scale: [0.99, 1.03, 0.99] }
            }
            viewport={{ once: false, amount: 0.3 }}
            transition={{
              duration: 3.2,
              ease: "easeInOut",
              repeat: Infinity,
            }}
            style={{ willChange: "transform" }}
          >
            <Image
              src="/CHEF8.jpg"
              alt="Chef"
              width={420}
              height={420}
              className="w-full h-full object-cover"
              priority
            />
          </motion.div>

          <motion.div
            className="absolute right-0 bottom-0 w-[220px] h-[220px] sm:w-[280px] sm:h-[280px] rounded-3xl shadow-2xl overflow-hidden -translate-y-3 z-10"
            initial={prefersReducedMotion ? {} : { y: -8, rotate: 1, scale: 0.99 }}
            whileInView={
              prefersReducedMotion
                ? {}
                : { y: [-8, 4, -8], rotate: [1, -3, 1], scale: [0.99, 1.02, 0.99] }
            }
            viewport={{ once: false, amount: 0.25 }}
            transition={{
              duration: 3.6,
              ease: "easeInOut",
              repeat: Infinity,
            }}
            style={{ willChange: "transform" }}
          >
            <Image
              src="/GGGG1.jpg"
              alt="Food"
              width={560}
              height={560}
              className="w-full h-full object-cover"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
