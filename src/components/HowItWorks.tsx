"use client";

import React, { ReactNode } from "react";
import { motion } from "framer-motion";
import { FaUtensils } from "react-icons/fa";
import { FaBirthdayCake } from "react-icons/fa";
import { FaCookieBite } from "react-icons/fa6";
import { FaCheckCircle } from "react-icons/fa";
import { FaMotorcycle } from "react-icons/fa";
import { FaCalendarCheck } from "react-icons/fa";
import { FaUserTie } from "react-icons/fa";

interface Service {
  title: string;
  icon: ReactNode;
  description: string;
  features: string[];
}

const HowItWorks: React.FC = () => {
  const services: Service[] = [
    {
      title: "Restaurants",
      icon: <FaUtensils className="text-5xl" />,
      description: "Discover Top-rated Food Vendors Near You.",
      features: ["Explore a variety of cuisines", "Trusted vendors with excellent hygiene ratings", "Instant ordering and secure payments"],
    },
    {
     title: "Hire a Chef & Catering",
      icon: <FaUserTie className="text-5xl" />,
      description: "Book top chefs for private dining and event catering.",
      features: ["Custom menus", "Premium catering", "Home dining experiences"],
    },
    {
     title: "Online Ordering & Delivery",
      icon: <FaMotorcycle className="text-5xl" />,
      description: "Order food online and get it delivered fast.",
      features: ["Live order tracking", "Multiple payment options", "No-contact delivery"],
    },
  ];

  const extraServices: Service[] = [
    {
      title: "Pastries",
        icon: <FaCookieBite className="text-5xl" />,
        description: "Freshly baked pastries from multiple local vendors.",
        features: ["Variety of flavors", "Daily fresh batches", "Custom orders available"],
    },
    {
      title: "Cakes",
        icon: <FaBirthdayCake className="text-5xl" />,
        description: "Custom cakes from different bakers for birthdays, weddings, and events.",
        features: ["Multiple vendors", "Premium ingredients", "Delivery available"],
    },
    {
      title: "Hire Home Cook",
      icon: <FaCalendarCheck className="text-5xl" />,
      description: "Enjoy fresh, homemade meals prepared by home cooks.",
      features: ["Authentic home-styled food", "Skilled, verified cooks", "Cook at your home or meal prep"],
    },
   
   
  ];

  return (
    <section id="features" className="bg-hospineil-base-bg py-16 px-6">
      <div className="text-center mb-12">
           <h2 className="text-4xl md:text-5xl font-header italic tracking-wide capitalize">
      what we are about
    </h2>
        <p className="text-lg text-gray-800 mt-2 font-body">
          Connecting you with the best vendors.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {services.map((service, index) => (
          <motion.div
            key={index}
            className="bg-hospineil-light-bg p-8 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 hover:shadow-hospineil-primary/20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
          >
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
                  delay: index * 0.15 + 0.2 
                }}
                whileHover={{ 
                  scale: 1.2, 
                  rotate: [0, -10, 10, -10, 0],
                  transition: { duration: 0.5 }
                }}
              >
                {service.icon}
              </motion.div>
            </div>
            <h3 className="text-2xl font-semibold text-center font-header">{service.title}</h3>
            <p className="text-gray-800 text-center mt-2 font-body">{service.description}</p>
            <ul className="mt-4 space-y-2">
              {service.features.map((feature, idx) => (
                <li key={idx} className="flex items-center text-gray-800 font-body">
                  <FaCheckCircle className="text-hospineil-accent mr-2 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      <div className="text-center mt-16">
        <h3 className="text-3xl font-semibold font-header">More Features</h3>
        <p className="text-lg text-gray-800 mt-2 font-body">
          We provide extra services to enhance your experience.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8 max-w-6xl mx-auto">
          {extraServices.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-hospineil-light-bg p-6 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 hover:shadow-hospineil-primary/20"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
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
                    delay: index * 0.1 + 0.2 
                  }}
                  whileHover={{ 
                    scale: 1.2, 
                    rotate: [0, -10, 10, -10, 0],
                    transition: { duration: 0.5 }
                  }}
                >
                  {feature.icon}
                </motion.div>
              </div>
              <h4 className="text-xl font-semibold text-center font-header">{feature.title}</h4>
              <p className="text-gray-800 text-center mt-2 font-body">{feature.description}</p>

              <ul className="mt-4 space-y-2">
                {feature.features.map((item, idx) => (
                  <li key={idx} className="flex items-center text-gray-800">
                    <FaCheckCircle className="text-hospineil-accent mr-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
