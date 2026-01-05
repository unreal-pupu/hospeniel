"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HL from "../../../public/HL.jpg";

export default function FoodVendorsPage() {
  const router = useRouter();

  const vendors = [
    {
      id: 1,
      name: "Tasty Kitchen",
      image: HL,
      description:
        "Authentic Nigerian dishes with a modern twist — freshly cooked and delivered hot.",
    },
    {
      id: 2,
      name: "Mama's Delight",
      image: HL,
      description:
        "Home-style meals made with love — jollof rice, egusi soup, pounded yam, and more.",
    },
    {
      id: 3,
      name: "Urban Plates",
      image: HL,
      description:
        "Healthy and delicious restaurant meals with premium ingredients and fast delivery.",
    },
    {
      id: 4,
      name: "Flavour Spot",
      image: HL,
      description:
        "A fusion of local and continental cuisines served with flair and taste.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-gray-100 px-4 sm:px-6 py-16">
      <div className="flex flex-col sm:flex-row items-center justify-between max-w-6xl mx-auto mb-10 gap-4 text-center sm:text-left">
        <Button
          onClick={() => router.push("/explore")}
          variant="outline"
          className="text-sm sm:text-base font-medium border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-300 shadow-sm sm:w-auto w-full rounded-full py-2"
        >
          ← Back to Explore
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold text-emerald-700 drop-shadow-sm">
          Food Vendors
        </h1>

        <div className="hidden sm:block w-[150px]" />
      </div>

      <p className="text-center text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
        Discover trusted food vendors around you — order freshly made dishes from your favorite kitchens.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {vendors.map((vendor) => (
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
                <h3 className="text-lg font-semibold mb-2 text-emerald-700">
                  {vendor.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
                  {vendor.description}
                </p>
              </div>

              <Button
                onClick={() => router.push(`/vendor/${vendor.id}`)}
                className="mt-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg transition-all rounded-full w-full sm:w-auto py-2"
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
