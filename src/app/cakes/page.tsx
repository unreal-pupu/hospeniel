"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DEST8 from "../../../public/DEST8.jpg";

export default function CakesPage() {
  const router = useRouter();

  const cakeVendors = [
    {
      id: 1,
      name: "Sweet Layers Cakes",
      image: DEST8,
      description:
        "Custom cakes for birthdays, weddings, and all occasions. Every bite is a celebration!",
    },
    {
      id: 2,
      name: "Heavenly Bakes",
      image: DEST8,
      description:
        "Classic sponge cakes, cupcakes, and fondant masterpieces — baked to perfection.",
    },
    {
      id: 3,
      name: "Choco Dreams Bakery",
      image: DEST8,
      description:
        "Indulge in premium chocolate cakes, red velvet, and buttercream fantasies.",
    },
    {
      id: 4,
      name: "Elegant Treats",
      image: DEST8,
      description:
        "Delightful cakes designed with artistic flair and irresistible taste.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-100 dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-gray-100 px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between max-w-6xl mx-auto mb-10 gap-4 text-center sm:text-left">
        <Button
          onClick={() => router.push("/explore")}
          variant="outline"
          className="text-sm sm:text-base font-medium border-2 border-rose-400 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 shadow-sm sm:w-auto w-full rounded-full py-2"
        >
          ← Back to Explore
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold text-rose-700 drop-shadow-sm">
          Cakes & Confections
        </h1>

        <div className="hidden sm:block w-[150px]" />
      </div>

      <p className="text-center text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
        Explore top cake vendors in your city. Whether it's birthdays, weddings, or events — find the perfect cake for your celebration.
      </p>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {cakeVendors.map((vendor) => (
          <Card
            key={vendor.id}
            className="overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <div className="relative w-full h-56">
              <Image
                src={vendor.image}
                alt={vendor.name}
                fill
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <CardContent className="p-4 flex flex-col justify-between h-44">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-rose-700">
                  {vendor.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
                  {vendor.description}
                </p>
              </div>

              <Button
                onClick={() => router.push(`/vendor/${vendor.id}`)}
                className="mt-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-md hover:shadow-lg transition-all rounded-full w-full sm:w-auto py-2"
              >
                View Vendors
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
