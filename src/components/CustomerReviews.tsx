"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

import CONFI from "../../public/CONFI.jpg";
import EDUBA from '../../public/EDUBA.jpg'
import EGAI from '../../public/EGAI.jpg'
import REIYA from '../../public/REIYA.jpg'

const reviews = [
  { id: 1, name: "Reiya", profession: "Entrepreneur", text: "Finding reliable chefs, bakers, and food vendors used to be a stressful process. With Hospineil, I can browse vendors, see their menus, and even contact them directly for outdoor services. It’s like having a marketplace and management tool in one platform!", image: REIYA },
  { id: 2, name: "Starboy Ebix", profession: "Digital Creator", text: "Hospineil has completely transformed how I manage my orders. I used to spend hours coordinating with different vendors and tracking payments manually. Now, everything is in one place, real-time, and so easy to monitor. My workflow has never been smoother!", image: EGAI },
  { id: 3, name: "Edubamoere Alaboh", profession: "Food Vendor", text: "I love how Hospineil lets me showcase my products to customers while keeping my orders organized. The notifications and payment system make it so easy to know exactly what’s coming in. It’s saving me time and helping me grow my business.", image: EDUBA },
  { id: 4, name: "Confidence Columbus", profession: "Freelance Writer", text: "As someone who orders catering and baked goods regularly, Hospineil makes the process incredibly convenient. I can filter vendors by location, see menus, and place orders in seconds. It has simplified my life!", image: CONFI },
];

export default function CustomerReviews() {
  const [selectedReview, setSelectedReview] = useState(reviews[0]);

  return (
    <section id="testimonials" className="w-full max-w-3xl mx-auto text-center py-10 px-4 sm:px-6 bg-hospineil-base-bg">
      <motion.h2 
        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-[80px] font-medium mb-6 pt-12 sm:pt-16 md:pt-20 font-header leading-tight"
        initial={{ opacity: 0, y: -30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 20,
          duration: 0.6
        }}
      >
        What Our Customers Say
      </motion.h2>

      {/* Profile selector */}
      <motion.div 
        className="flex justify-center gap-4 sm:gap-6 flex-wrap px-2"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 20,
          delay: 0.2,
          duration: 0.6
        }}
      >
        {reviews.map((review, index) => (
          <motion.div
            key={review.id}
            className="flex flex-col items-center cursor-pointer"
            onClick={() => setSelectedReview(review)}
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 15,
              delay: 0.3 + (index * 0.1),
              duration: 0.5
            }}
            whileHover={{ scale: 1.1, y: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{
                scale: selectedReview.id === review.id ? 1.1 : 1,
                borderColor: selectedReview.id === review.id ? "#5EB8C2" : "#D1D5DB",
              }}
              transition={{ duration: 0.3 }}
            >
              <Image
                src={review.image}
                alt={review.name}
                width={80}
                height={80}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-full border-2 shadow-md"
              />
            </motion.div>
            <h4 className="mt-2 text-base sm:text-lg font-semibold font-header text-gray-800">{review.name}</h4>
            <p className="text-gray-600 text-xs sm:text-sm font-body">{review.profession}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div 
        className="bg-hospineil-light-bg p-4 sm:p-6 rounded-2xl shadow-md mt-6 hover:shadow-lg transition-all duration-300 mx-2 sm:mx-0"
        key={selectedReview.id}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 20,
          duration: 0.5
        }}
      >
        <motion.p 
          className="text-base sm:text-lg italic text-gray-800 font-body leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {selectedReview.text}
        </motion.p>
      </motion.div>
    </section>
  );
}
