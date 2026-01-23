"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FiSearch, FiStar } from "react-icons/fi";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";

import CHEF7 from "../../../public/CHEF7.jpg";
import DEST8 from "../../../public/DEST8.jpg";
import CHEF9 from "../../../public/CHEF9.jpg";
import QV from "../../../public/QV.jpg";

// Vendor type
interface Vendor {
  id: number;
  name: string;
  category: "Chef" | "Restaurant" | "Baker" | "Pastry";
  tagline: string;
  rating: number;
  image: string | { src: string; height: number; width: number; blurDataURL?: string } | StaticImageData;
}

// Vendor data
const vendors: Vendor[] = [
  {
    id: 1,
    name: "Chef Amara",
    category: "Chef",
    tagline: "Private dining & catering",
    rating: 4.8,
    image: CHEF7,
  },
  {
    id: 2,
    name: "Golden Crust Bakery",
    category: "Baker",
    tagline: "Freshly baked pastries daily",
    rating: 4.6,
    image: DEST8,
  },
  {
    id: 3,
    name: "OceanView Restaurant",
    category: "Restaurant",
    tagline: "Fine dining with a view",
    rating: 4.9,
    image: CHEF9,
  },
  {
    id: 4,
    name: "Sweet Tooth Pastries",
    category: "Pastry",
    tagline: "Cakes, pies & sweet treats",
    rating: 4.7,
    image: QV,
  },
];

export default function VendorListing() {
  const [search, setSearch] = useState("");

  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor.name.toLowerCase().includes(search.toLowerCase()) ||
      vendor.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="w-full min-h-screen px-6 md:px-12 lg:px-20 py-12 bg-gray-50">
      {/* Page Title */}
      <h1 className="text-3xl md:text-5xl font-bold text-center text-gray-900 mb-10">
        Explore Our Vendors
      </h1>

      {/* Search Bar */}
      <div className="flex items-center justify-center mb-10 max-w-lg mx-auto gap-2">
        <Input
          type="text"
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-full px-4 py-2"
        />
        <Button className="rounded-full px-4 py-2 flex items-center gap-2">
          <FiSearch /> Search
        </Button>
      </div>

      {/* Vendor Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredVendors.map((vendor) => (
          <Card
            key={vendor.id}
            className="rounded-2xl shadow-md hover:shadow-xl transition overflow-hidden"
          >
            <div className="relative w-full h-48">
              <Image
                src={vendor.image}
                alt={vendor.name}
                fill
                className="object-cover"
              />
            </div>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xl font-semibold text-gray-900">
                {vendor.name}
              </h3>
              <p className="text-sm text-gray-600">{vendor.tagline}</p>
              <div className="flex items-center gap-1 text-yellow-500">
                <FiStar />
                <span className="text-sm font-medium text-gray-800">
                  {vendor.rating}
                </span>
              </div>
              <Link href={`/vendors/${vendor.id}`}>
             <Button className="mt-3 w-full rounded-full bg-indigo-600 text-white hover:bg-indigo-700">View Profile</Button>
             </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
