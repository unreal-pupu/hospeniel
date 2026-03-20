"use client";

import React, { ReactNode } from "react";
import { motion } from "framer-motion";
import { FaUtensils } from "react-icons/fa";
import { FaMotorcycle } from "react-icons/fa";
import { FaUserTie } from "react-icons/fa";

interface Service {
  title: string;
  icon: ReactNode;
  text: string;
}

const HowItWorks: React.FC = () => {
  const services: Service[] = [
    {
      title: "Explore vendors",
      icon: <FaUtensils className="text-5xl" />,
      text: "Browse a variety of food, cakes, and pastries from vendors near you",
    },
    {
      title: "Order your favorite meal",
      icon: <FaUserTie className="text-5xl" />,
      text: "Select the items you love from vendor menus and place your order",
    },
    {
      title: "Enjoy fast delivery",
      icon: <FaMotorcycle className="text-5xl" />,
      text: "Get your food delivered quickly, fresh, and right to your doorstep",
    },
  ];

  return (
    <section id="features" className="bg-hospineil-base-bg py-20 px-6">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-header font-bold tracking-tight">
          How it works
        </h2>
        <p className="text-lg text-gray-800 mt-3 font-body">
          Order from your favorite vendors in just a few simple steps
        </p>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
        {services.map((service, index) => {
          const stepLabel = String(index + 1).padStart(2, "0");

          return (
            <React.Fragment key={service.title}>
              <div className="w-full lg:flex-1">
                <motion.div
                  className="h-full bg-hospineil-light-bg p-8 rounded-2xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 hover:shadow-hospineil-primary/20"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                >
                  <div className="font-header font-bold tracking-[0.35em] text-xs text-hospineil-primary/90 text-center mb-4">
                    {stepLabel}
                  </div>

                  <div className="flex items-center justify-center mb-4">
                    <motion.div
                      className="text-hospineil-primary"
                      initial={{ opacity: 0, scale: 0, rotate: -180 }}
                      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                        delay: index * 0.15 + 0.2,
                      }}
                      whileHover={{
                        scale: 1.1,
                        rotate: [0, -6, 6, -6, 0],
                        transition: { duration: 0.45 },
                      }}
                    >
                      {service.icon}
                    </motion.div>
                  </div>

                  <h3 className="text-2xl font-semibold text-center font-header">
                    {service.title}
                  </h3>
                  <p className="text-gray-800 text-center mt-3 font-body leading-relaxed">
                    {service.text}
                  </p>
                </motion.div>
              </div>

              {/* Desktop-only flow connector */}
              {index < services.length - 1 && (
                <div
                  className="hidden lg:flex items-center justify-center w-10 text-hospineil-primary/80 font-header text-4xl select-none"
                  aria-hidden
                >
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};

export default HowItWorks;
