"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Search, FileText, CheckCircle2, UtensilsCrossed, ArrowRight } from "lucide-react";

const HomeCookChefPromo: React.FC = () => {
  const router = useRouter();

  const steps = [
    {
      icon: <Search className="text-4xl" />,
      title: "Find a Cook",
      description: "Browse available home cooks and chefs"
    },
    {
      icon: <FileText className="text-4xl" />,
      title: "Submit a Request",
      description: "Tell them what meal you want, when, and for how many people"
    },
    {
      icon: <CheckCircle2 className="text-4xl" />,
      title: "Cook Accepts & Confirms Price",
      description: "Your cook confirms availability and cost"
    },
    {
      icon: <UtensilsCrossed className="text-4xl" />,
      title: "Enjoy Your Meal",
      description: "Payment is made and your meal is prepared or delivered"
    }
  ];

  const handleRequestCook = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/register");
      return;
    }
    router.push("/explore");
  };

  return (
    <section id="home-cook-chef-promo" className="py-16 px-6 rounded-lg mt-12 bg-gradient-to-r from-hospineil-primary to-hospineil-accent">
      <div className="max-w-6xl mx-auto">
        {/* Headline and Subtext */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true }}
        >
          <motion.h2
            className="text-4xl md:text-5xl font-extrabold mb-4 text-white font-header"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Hire a Home Cook or Personal Chef for Any Meal
          </motion.h2>

          <motion.p
            className="mt-4 text-lg md:text-xl font-light font-body text-white/95 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
          >
            Looking for a chef for a family dinner, party, or special occasion? Our trusted home cooks and chefs can prepare fresh meals tailored to your needs. Simply request a cook, choose your meal, and we will handle the rest.
          </motion.p>
        </motion.div>

        {/* How It Works Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="bg-white/10 backdrop-blur-sm p-6 rounded-xl hover:bg-white/20 transition-all duration-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <motion.div
                className="flex items-center justify-center mb-4 text-white"
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: index * 0.1 + 0.3
                }}
                whileHover={{
                  scale: 1.2,
                  rotate: [0, -10, 10, -10, 0],
                  transition: { duration: 0.5 }
                }}
              >
                {step.icon}
              </motion.div>
              <h3 className="text-xl font-semibold text-white mb-2 text-center font-header">
                {step.title}
              </h3>
              <p className="text-white/90 text-sm text-center font-body leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
        >
          <Button
            onClick={handleRequestCook}
            className="bg-white text-hospineil-primary hover:bg-white/90 font-semibold px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300 font-button"
            size="lg"
          >
            Request a Cook
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default HomeCookChefPromo;
