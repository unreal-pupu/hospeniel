"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DORCAS from "../../../public/DORCAS.jpg";


export default function HireAChefPage() {
  const router = useRouter();

  const chefs = [
    {
      id: 1,
      name: "Chef Amara",
      image: DORCAS,
      description:
        "Private dining experiences and event catering — African and continental dishes.",
    },
    {
      id: 2,
      name: "Chef Tobi",
      image: DORCAS,
      description:
        "Expert in gourmet meals, perfect for dinner parties and exclusive events.",
    },
    {
      id: 3,
      name: "Chef Lola",
      image: DORCAS,
      description:
        "Specializes in pastries and fusion cuisines with attention to detail and presentation.",
    },
    {
      id: 4,
      name: "Chef Ugo",
      image: DORCAS,
      description:
        "Bringing restaurant-quality food to your home or event. Taste excellence!",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-gray-100 px-4 sm:px-6 py-16">
      <div className="flex flex-col sm:flex-row items-center justify-between max-w-6xl mx-auto mb-10 gap-4 text-center sm:text-left">
        <Button
          onClick={() => router.push("/explore")}
          variant="outline"
          className="text-sm sm:text-base font-medium border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all duration-300 shadow-sm sm:w-auto w-full rounded-full py-2"
        >
          ← Back to Explore
        </Button>

        <h1 className="text-3xl md:text-4xl font-bold text-indigo-700 drop-shadow-sm">
          Hire a Chef
        </h1>

        <div className="hidden sm:block w-[150px]" />
      </div>

      <p className="text-center text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-12 text-base sm:text-lg">
        Book professional chefs for private events, in-home dining, and catering services.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {chefs.map((chef) => (
          <Card
            key={chef.id}
            className="overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <div className="relative w-full h-56">
              <Image
                src={chef.image}
                alt={chef.name}
                fill
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <CardContent className="p-4 flex flex-col justify-between h-44">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-indigo-700">
                  {chef.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
                  {chef.description}
                </p>
              </div>

              <Button
                onClick={() => router.push(`/vendor/${chef.id}`)}
                className="mt-4 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md hover:shadow-lg transition-all rounded-full w-full sm:w-auto py-2"
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
