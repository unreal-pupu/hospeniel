"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DORCAS from "../../../public/DORCAS.jpg";
import CHEF7 from "../../../public/CHEF7.jpg";
import HL from "../../../public/HL.jpg";
import DEST8 from "../../../public/DEST8.jpg";

export default function PastriesPage() {
  const router = useRouter();

  const pastryVendors = [
    {
      id: 1,
      name: "Dorcas Pastry Delights",
      image: DORCAS,
      description:
        "A wide variety of flaky croissants, meat pies, and sweet rolls made fresh daily with premium ingredients.",
    },
    {
      id: 2,
      name: "Golden Crust Bakery",
      image: HL,
      description:
        "From sausage rolls to puff pastries — indulge in buttery, golden goodness that melts in your mouth.",
    },
    {
      id: 3,
      name: "Chef7 Patisserie",
      image: CHEF7,
      description:
        "European-style pastries crafted by expert chefs. Perfect for coffee mornings and special occasions.",
    },
    {
      id: 4,
      name: "Destiny Pastry House",
      image: DEST8,
      description:
        "Your go-to bakery for tarts, éclairs, and delicious pastries made with a touch of artistry and passion.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-gray-100 px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between max-w-6xl mx-auto mb-10 gap-4 text-center sm:text-left">
        <Button
          onClick={() => router.push("/explore")}
          variant="outline"
          className="text-sm sm:text-base font-medium border-2 border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white transition-all duration-300 shadow-sm sm:w-auto w-full rounded-full py-2"
        >
          ← Back to Explore
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold text-amber-700 drop-shadow-sm">
          Pastries & Baked Goodies
        </h1>

        {/* Spacer for symmetry */}
        <div className="hidden sm:block w-[150px]" />
      </div>

      <p className="text-center text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
        Explore the best pastry chefs and bakeries around — from croissants to éclairs, all baked with love and care.
      </p>

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {pastryVendors.map((vendor) => (
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
                <h3 className="text-lg font-semibold mb-2 text-amber-700">
                  {vendor.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
                  {vendor.description}
                </p>
              </div>

              {/* Modern Button for Mobile */}
              <Button
                onClick={() => router.push(`/vendor/${vendor.id}`)}
                className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all rounded-full w-full sm:w-auto py-2"
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
