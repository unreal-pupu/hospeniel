"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { validatePassword, getPasswordRequirements } from "@/lib/passwordValidation";

const LOCATIONS = [
  "Bayelsa",
  "Port Harcourt",
  "Lagos",
  "Abuja",
];

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

const VENDOR_CATEGORIES = [
  { label: "Food Vendor", value: "food_vendor" },
  { label: "Chef", value: "chef" },
  { label: "Baker", value: "baker" },
  { label: "Finger Chop", value: "finger_chop" },
];

interface Bank {
  id: number;
  name: string;
  code: string;
  longcode?: string;
  gateway?: string;
  pay_with_bank?: boolean;
  active?: boolean;
  is_deleted?: boolean;
  country?: string;
  currency?: string;
  type?: string;
  slug?: string;
}

export default function RegisterPage() {
  const [role, setRole] = useState("user");
  const [name, setName] = useState("");
  const [businessAddress, setBusinessAddress] = useState(""); // For vendors
  const [userAddress, setUserAddress] = useState(""); // For users
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loadingBanks, setLoadingBanks] = useState(false);
  // Phone field (for users)
  const [phoneNumber, setPhoneNumber] = useState("");
  const router = useRouter();

  // Reset location and category when role changes from vendor to user
  useEffect(() => {
    if (role !== "vendor") {
      setLocation("");
      setCategory("");
      setBankCode("");
      setAccountNumber("");
      setBusinessAddress("");
    }
    // Reset user address and phone fields when switching to vendor
    if (role === "vendor") {
      setUserAddress("");
      setPhoneNumber("");
    }
  }, [role]);

  // Fetch banks when role is vendor
  useEffect(() => {
    if (role === "vendor" && banks.length === 0) {
      fetchBanks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const fetchBanks = async () => {
    try {
      setLoadingBanks(true);
      const res = await fetch("/api/banks");
      const data = await res.json();
      
      if (data.success && data.banks && Array.isArray(data.banks)) {
        // Filter only active banks that support pay_with_bank
        // Also include banks that don't have pay_with_bank set (some banks might not have this field)
        const activeBanks = data.banks.filter(
          (bank: Bank) => bank.active !== false && (bank.pay_with_bank !== false)
        );
        
        // Sort banks alphabetically by name
        activeBanks.sort((a: Bank, b: Bank) => a.name.localeCompare(b.name));
        
        setBanks(activeBanks);
        console.log(`✅ Loaded ${activeBanks.length} banks from ${data.source || 'Paystack'}`);
      } else {
        console.error("Failed to fetch banks:", data.error || "Unknown error");
        // Don't show alert, just log the error - the dropdown will show empty state
      }
    } catch (error) {
      console.error("Error fetching banks:", error);
      // Don't show alert, just log the error - the dropdown will show empty state
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password match
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordErrors(passwordValidation.errors);
      alert("Password does not meet security requirements:\n" + passwordValidation.errors.join("\n"));
      return;
    }

    setLoading(true);

    try {
      // Validate address and phone for users
      if (role === "user") {
        if (!userAddress || userAddress.trim() === "") {
          alert("Please enter your address");
          setLoading(false);
          return;
        }
        if (!phoneNumber || phoneNumber.trim() === "") {
          alert("Please enter your phone number");
          setLoading(false);
          return;
        }
      }

      // Validate location and category for vendors
      if (role === "vendor") {
        if (!location) {
          alert("Please select a location");
          setLoading(false);
          return;
        }
        if (!category) {
          alert("Please select a category");
          setLoading(false);
          return;
        }
        if (!businessAddress || businessAddress.trim() === "") {
          alert("Please enter your business address");
          setLoading(false);
          return;
        }
        if (!bankCode) {
          alert("Please select a bank");
          setLoading(false);
          return;
        }
        if (!accountNumber || accountNumber.length < 10) {
          alert("Please enter a valid account number (at least 10 digits)");
          setLoading(false);
          return;
        }
      }

      // Build request body object - ensure all fields are properly defined
      const requestBody: Record<string, any> = {
        email: email || "",
        password: password || "",
        name: name || "",
        role: role || "user",
      };
      
      // Add address based on role - always ensure it's a string
      if (role === "vendor") {
        requestBody.address = businessAddress || "";
        requestBody.location = location || null;
        requestBody.category = category || null;
        requestBody.bank_code = bankCode || null;
        requestBody.account_number = accountNumber || null;
        requestBody.business_name = name || null;
      } else if (role === "user") {
        requestBody.address = userAddress || "";
        requestBody.phone_number = phoneNumber || null;
      } else {
        // Fallback: always include address field (empty string)
        requestBody.address = "";
      }
      
      // ✅ SECURITY: Never log passwords - only log non-sensitive data
      console.log("Submitting registration with data:", {
        email: requestBody.email,
        name: requestBody.name,
        role: requestBody.role,
        address: requestBody.address || "(empty)",
        location: requestBody.location || "(empty)",
        category: requestBody.category || "(empty)",
        phone_number: requestBody.phone_number || "(empty)",
        // Password is intentionally NOT logged for security
      });

      // Send registration request
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Check if response is ok before trying to parse JSON
      let data;
      try {
        const responseText = await res.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("Failed to parse response:", parseError);
        alert("Registration failed. Please try again.");
        setLoading(false);
        return;
      }
      
      console.log("Register response:", data);

      // Handle rate limit errors
      if (res.status === 429) {
        const retryAfter = data?.retryAfter || 60;
        alert(`Too many registration attempts. Please wait ${retryAfter} seconds before trying again.`);
        setLoading(false);
        return;
      }

      if (!res.ok || !data?.success) {
        const errorMsg = data?.error || data?.message || "Registration failed.";
        console.error("Registration error:", errorMsg, data);
        alert("Error: " + errorMsg);
        setLoading(false);
        return;
      }

      // Show different success messages based on user role
      if (role === "vendor") {
        // Vendor registration: subaccount creation is handled in the API
        alert("✅ Registration successful! Your Paystack subaccount has been created. Please verify your email before logging in.");
      } else {
        // Regular user registration: no subaccount message
        alert("✅ Registration successful! Please verify your email before logging in.");
      }
      
      // Check for returnUrl in sessionStorage (set when user tries to checkout)
      let redirectPath = "/loginpage";
      if (typeof window !== "undefined") {
        const returnUrl = sessionStorage.getItem("returnUrl");
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/admin') && !returnUrl.startsWith('/vendor')) {
          redirectPath = `/loginpage?redirect=${encodeURIComponent(returnUrl)}`;
        }
      }
      
      router.push(redirectPath);
    } catch (err: any) {
      console.error("Registration failed:", err);
      console.error("Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      
      // Provide more helpful error messages
      let errorMessage = "Registration failed. ";
      if (err.message) {
        if (err.message.includes("address is not defined")) {
          errorMessage += "There was an issue with the address field. Please ensure all required fields are filled.";
        } else if (err.message.includes("fetch")) {
          errorMessage += "Network error. Please check your connection and try again.";
        } else {
          errorMessage += err.message;
        }
      } else {
        errorMessage += "Please try again or contact support if the problem persists.";
      }
      
      alert(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hospineil-base-bg px-4">
      <Card className="w-full max-w-lg shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold font-logo tracking-tight">
              Hospe<span className="italic text-hospineil-accent">niel</span>
            </h2>
            <p className="text-gray-600 text-sm font-body mt-2">Your journey starts here.</p>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Name / Business Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                {role === "vendor" ? "Business Name" : "Full Name"} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  role === "vendor"
                    ? "Enter your business name"
                    : "Enter your full name"
                }
                required
                className="bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11"
              />
            </div>

            {/* Address (only for vendor) */}
            {role === "vendor" && (
              <div className="space-y-2">
                <Label htmlFor="businessAddress" className="text-sm font-medium text-gray-700">
                  Business Address
                </Label>
                <Input
                  id="businessAddress"
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Enter your business address"
                  required
                  className="bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all"
                />
              </div>
            )}

            {/* Address and Phone Fields (only for users) */}
            {role === "user" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="userAddress" className="text-sm font-medium text-gray-700">
                    Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="userAddress"
                    type="text"
                    value={userAddress}
                    onChange={(e) => setUserAddress(e.target.value)}
                    placeholder="Enter your full address (street, city, state)"
                    required
                    className="bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Include street address, city, and state for accurate delivery
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      // Only allow digits and + for phone numbers
                      const value = e.target.value.replace(/[^\d+]/g, "");
                      setPhoneNumber(value);
                    }}
                    placeholder="e.g., +2348012345678 or 08012345678"
                    required
                    className="bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll use this to contact you about your orders
                  </p>
                </div>
              </>
            )}

            {/* Location (only for vendor) */}
            {role === "vendor" && (
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select
                  onValueChange={(value) => setLocation(value)}
                  value={location}
                  required
                >
                  <SelectTrigger id="location" className="w-full">
                    <SelectValue placeholder="Select your location" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category (only for vendor) */}
            {role === "vendor" && (
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  onValueChange={(value) => setCategory(value)}
                  value={category}
                  required
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="Select your category" />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Bank Details (only for vendor) */}
            {role === "vendor" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bank" className="text-sm font-medium text-gray-700">
                    Bank Name <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(value) => {
                      setBankCode(value);
                      console.log("Selected bank code:", value);
                    }}
                    value={bankCode}
                    required
                    disabled={loadingBanks}
                  >
                    <SelectTrigger id="bank" className="w-full bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11">
                      <SelectValue placeholder={loadingBanks ? "Loading banks..." : banks.length > 0 ? "Select your bank" : "No banks available"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200 max-h-[300px] overflow-y-auto">
                      {banks.length > 0 ? (
                        banks.map((bank) => (
                          <SelectItem key={bank.code} value={bank.code} className="hover:bg-gray-100 cursor-pointer">
                            {bank.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-banks" disabled className="text-gray-400">
                          {loadingBanks ? "Loading banks..." : "No banks available"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {loadingBanks && (
                    <p className="text-xs text-gray-500">Loading banks...</p>
                  )}
                  {!loadingBanks && banks.length > 0 && (
                    <p className="text-xs text-gray-500">{banks.length} banks available</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber" className="text-sm font-medium text-gray-700">
                    Account Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="accountNumber"
                    type="text"
                    value={accountNumber}
                    onChange={(e) => {
                      // Only allow digits
                      const value = e.target.value.replace(/\D/g, "");
                      setAccountNumber(value);
                    }}
                    placeholder="Enter your account number"
                    required
                    minLength={10}
                    className="bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter your account number (minimum 10 digits)</p>
                </div>
              </>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="pl-10 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2 relative">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    // Validate password on change
                    if (e.target.value.length > 0) {
                      const validation = validatePassword(e.target.value);
                      setPasswordErrors(validation.errors);
                    } else {
                      setPasswordErrors([]);
                    }
                  }}
                  placeholder="Create a strong password"
                  required
                  className="pl-10 pr-10 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-hospineil-primary transition-colors duration-300"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {/* Password Requirements */}
              <p className="text-xs text-gray-500 mt-1">
                {getPasswordRequirements()}
              </p>
              {/* Password Errors */}
              {passwordErrors.length > 0 && (
                <ul className="text-xs text-red-500 list-disc list-inside mt-1">
                  {passwordErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2 relative">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="pl-10 pr-10 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-hospineil-primary transition-colors duration-300"
                >
                  {showConfirm ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                Account Type <span className="text-red-500">*</span>
              </Label>
              <Select onValueChange={(value) => setRole(value)} value={role}>
                <SelectTrigger id="role" className="w-full bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11">
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full mt-4 bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover transition-all duration-300 hover:scale-105 hover:shadow-lg font-button" 
              disabled={loading}
            >
              {loading ? "Registering..." : "Register"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600 font-body">
            Already have an account?{" "}
            <Link href="/loginpage" className="text-hospineil-primary hover:text-hospineil-accent transition-colors duration-300">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
