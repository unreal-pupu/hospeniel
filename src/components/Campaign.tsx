"use client";

import React from "react";
import { motion } from "framer-motion";

const Campaign: React.FC = () => {
  return (
    <section id="campaign" className="py-16 px-6 rounded-lg mt-12 bg-gradient-to-r from-hospineil-primary to-hospineil-accent">
      <motion.div
        className="max-w-4xl mx-auto text-center"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true }}
      >
        <motion.h2
          className="text-4xl font-extrabold mb-4 text-black font-header"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          Unlock Greater Profits with Targeted Marketing
        </motion.h2>

        <motion.p
          className="mt-4 text-lg font-light font-body text-gray-900"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
        >
          Elevate your business by executing strategic campaigns aimed at engaging customers and boosting sales. Whether introducing new products, providing discounts, or hosting seasonal promotions, campaigns can drive significant results.
        </motion.p>

        <motion.p
          className="mt-4 text-lg font-light font-body text-gray-900"
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          viewport={{ once: true }}
        >
          By employing the right approach, you can draw in new customers, keep your current ones loyal, and enhance your profits. Begin launching campaigns that engage your audience and drive conversions today!
        </motion.p>
      </motion.div>
    </section>
  );
};

export default Campaign;
