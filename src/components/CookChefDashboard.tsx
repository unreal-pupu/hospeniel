"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import { 
  Loader2, 
  Calendar, 
  Info,
  MapPin, 
  Users, 
  DollarSign, 
  MessageSquare,
  Check,
  X,
  Edit,
  Plus,
  Trash2,
  ChefHat
} from "lucide-react";

interface VendorProfile {
  id: string;
  name: string | null;
  email: string;
  role: string;
  category?: string | null;
  subscription_plan?: string;
  is_premium?: boolean;
}

interface ServiceProfile {
  id?: string;
  specialties: string[];
  pricing_model: 'per_meal' | 'per_hour' | 'per_job';
  base_price: number;
  service_mode: string[];
  bio?: string;
  image_url?: string;
}

interface BookingRequest {
  id: string;
  user_id: string;
  meal_type: string;
  number_of_people: number;
  special_instructions?: string;
  location: string;
  requested_date: string;
  requested_time: string;
  status: 'pending' | 'accepted' | 'declined' | 'pending_confirmation' | 'paid' | 'completed' | 'cancelled';
  base_price?: number;
  final_price?: number;
  price_confirmed: boolean;
  payment_reference?: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

interface AvailabilitySlot {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface CookChefMessage {
  id: string;
  booking_request_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export default function CookChefDashboard({ vendor }: { vendor: VendorProfile | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'availability' | 'requests' | 'jobs' | 'messages'>('requests');
  const [resolvedVendorId, setResolvedVendorId] = useState<string | null>(null);
  
  // Service Profile State
  const [serviceProfile, setServiceProfile] = useState<ServiceProfile>({
    specialties: [],
    pricing_model: 'per_meal',
    base_price: 0,
    service_mode: [],
    bio: '',
    image_url: ''
  });
  const [newSpecialty, setNewSpecialty] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Availability State
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [newSlot, setNewSlot] = useState({ date: '', start_time: '', end_time: '' });
  const [savingAvailability, setSavingAvailability] = useState(false);
  
  // Booking Requests State
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [editingPrice, setEditingPrice] = useState(false);
  const [editedPrice, setEditedPrice] = useState(0);
  const [loadingRequests, setLoadingRequests] = useState(false);
  
  // Messages State
  const [messages, setMessages] = useState<CookChefMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedRequestForChat, setSelectedRequestForChat] = useState<string | null>(null);

  const isValidUuid = (value: string | null | undefined) => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  };

  const resolveVendorId = useCallback(async (): Promise<string | null> => {
    if (resolvedVendorId && isValidUuid(resolvedVendorId)) return resolvedVendorId;
    if (vendor?.id && isValidUuid(vendor.id)) {
      setResolvedVendorId(vendor.id);
      return vendor.id;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Error fetching authenticated user for vendor ID:", error);
      return null;
    }
    if (user?.id && isValidUuid(user.id)) {
      setResolvedVendorId(user.id);
      return user.id;
    }
    return null;
  }, [resolvedVendorId, vendor?.id]);

  const loadServiceProfile = useCallback(async () => {
    const vendorId = await resolveVendorId();
    if (!vendorId) return;
    
    try {
      const { data, error } = await supabase
        .from('vendor_service_profiles')
        .select('*')
        .eq('profile_id', vendorId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading service profile:', error);
        return;
      }
      
      if (data) {
        setServiceProfile({
          specialties: data.specialties || [],
          pricing_model: data.pricing_model || 'per_meal',
          base_price: data.base_price || 0,
          service_mode: data.service_mode || [],
          bio: data.bio || '',
          image_url: data.image_url || ''
        });
        if (data.image_url) {
          setImagePreview(data.image_url);
        }
      }
    } catch (error) {
      console.error('Error loading service profile:', error);
    }
  }, [resolveVendorId]);

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);

      const vendorId = await resolveVendorId();
      if (!vendorId) {
        throw new Error('Vendor ID is required');
      }

      // Get file extension
      const fileExt = file.name.split('.').pop();
      if (!fileExt) {
        throw new Error('Invalid file type');
      }

      // Generate unique filename
      const fileName = `${vendorId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Delete old image if exists
      if (serviceProfile.image_url && serviceProfile.image_url.includes("vendor-images")) {
        try {
          const urlParts = serviceProfile.image_url.split("/vendor-images/");
          if (urlParts.length > 1) {
            const oldFilePath = urlParts[1];
            await supabase.storage
              .from("vendor-images")
              .remove([oldFilePath]);
          }
        } catch (error) {
          console.warn("Error deleting old image:", error);
        }
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("vendor-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
          throw new Error("Storage bucket 'vendor-images' not found. Please create it in Supabase Storage settings.");
        }
        if (uploadError.message?.includes("row-level security") || uploadError.message?.includes("RLS")) {
          throw new Error("Storage upload denied by security policy. Please check RLS policies.");
        }
        throw new Error(`Upload failed: ${uploadError.message || "Unknown error"}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("vendor-images")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    try {
      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload image
      const imageUrl = await uploadImage(file);
      if (imageUrl) {
        setServiceProfile({ ...serviceProfile, image_url: imageUrl });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error handling image:', error);
      alert('Failed to upload image: ' + errorMessage);
    }
  };

  const saveServiceProfile = async () => {
    const vendorId = await resolveVendorId();
    if (!vendorId) return;
    
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('vendor_service_profiles')
        .upsert({
          profile_id: vendorId,
          specialties: serviceProfile.specialties,
          pricing_model: serviceProfile.pricing_model,
          base_price: serviceProfile.base_price,
          service_mode: serviceProfile.service_mode,
          bio: serviceProfile.bio,
          image_url: serviceProfile.image_url
        }, {
          onConflict: 'profile_id'
        });
      
      if (error) throw error;
      
      // Verify the profile is complete and eligible to appear
      const { data: savedProfile } = await supabase
        .from('vendor_service_profiles')
        .select('specialties')
        .eq('profile_id', vendorId)
        .single();
      
      const hasProfile = !!savedProfile;
      
      // Trigger cache revalidation by dispatching a custom event
      // This will notify other components (Explore page, Homepage) to refetch data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vendor-service-profile-updated', {
          detail: { profile_id: vendorId, is_complete: hasProfile }
        }));
      }
      
      alert('Service profile saved successfully! Your profile will appear on the Explore page and Homepage.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving service profile:', error);
      alert('Failed to save service profile: ' + errorMessage);
    } finally {
      setSavingProfile(false);
    }
  };

  const addSpecialty = () => {
    if (newSpecialty.trim() && !serviceProfile.specialties.includes(newSpecialty.trim())) {
      setServiceProfile({
        ...serviceProfile,
        specialties: [...serviceProfile.specialties, newSpecialty.trim()]
      });
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (specialty: string) => {
    setServiceProfile({
      ...serviceProfile,
      specialties: serviceProfile.specialties.filter(s => s !== specialty)
    });
  };

  const toggleServiceMode = (mode: 'cook_and_deliver' | 'cook_at_customer_location') => {
    const currentModes = serviceProfile.service_mode || [];
    if (currentModes.includes(mode)) {
      setServiceProfile({
        ...serviceProfile,
        service_mode: currentModes.filter(m => m !== mode)
      });
    } else {
      setServiceProfile({
        ...serviceProfile,
        service_mode: [...currentModes, mode]
      });
    }
  };

  const loadAvailability = useCallback(async () => {
    const vendorId = await resolveVendorId();
    if (!vendorId) return;
    
    try {
      const { data, error } = await supabase
        .from('cook_chef_availability')
        .select('*')
        .eq('vendor_id', vendorId)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) {
        console.error('Error loading availability:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return;
      }
      
      setAvailabilitySlots(data || []);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  }, [resolveVendorId]);

  const addAvailabilitySlot = async () => {
    const vendorId = await resolveVendorId();
    if (!vendorId || !newSlot.date || !newSlot.start_time || !newSlot.end_time) {
      alert('Please fill in all fields');
      return;
    }
    
    setSavingAvailability(true);
    try {
      const { error } = await supabase
        .from('cook_chef_availability')
        .insert({
          vendor_id: vendorId,
          date: newSlot.date,
          start_time: newSlot.start_time,
          end_time: newSlot.end_time,
          is_available: true
        });
      
      if (error) throw error;
      
      setNewSlot({ date: '', start_time: '', end_time: '' });
      await loadAvailability();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error adding availability slot:', error);
      alert('Failed to add availability: ' + errorMessage);
    } finally {
      setSavingAvailability(false);
    }
  };

  const removeAvailabilitySlot = async (id: string) => {
    if (!confirm('Are you sure you want to remove this availability slot?')) return;
    
    try {
      const { error } = await supabase
        .from('cook_chef_availability')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await loadAvailability();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error removing availability slot:', error);
      alert('Failed to remove availability: ' + errorMessage);
    }
  };

  const loadBookingRequests = useCallback(async () => {
    const vendorId = await resolveVendorId();
    if (!vendorId) return;
    
    setLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('cook_chef_booking_requests')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading booking requests:', error);
        return;
      }
      
      // Fetch customer profiles separately
      const userIds = [...new Set((data || []).map((request) => request.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone_number')
        .in('id', userIds);
      
      // Create a map of user_id to profile
      const profileMap = new Map(
        (profiles || []).map((profile) => [profile.id, profile])
      );
      
      // Transform data to include customer info
      const transformed = (data || []).map((request) => {
        const profile = profileMap.get(request.user_id);
        return {
          ...request,
          customer_name: profile?.name || 'Customer',
          customer_phone: profile?.phone_number || ''
        };
      });
      
      setBookingRequests(transformed);
    } catch (error) {
      console.error('Error loading booking requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  }, [resolveVendorId]);

  const loadDashboardData = useCallback(async () => {
    const vendorId = await resolveVendorId();
    if (!vendorId) return;

    setLoading(true);
    try {
      await Promise.all([
        loadServiceProfile(),
        loadAvailability(),
        loadBookingRequests()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadAvailability, loadBookingRequests, loadServiceProfile, resolveVendorId]);

  useEffect(() => {
    let isMounted = true;

    const loadWithResolvedId = async () => {
      const vendorId = await resolveVendorId();
      if (!vendorId) {
        if (isMounted) setLoading(false);
        return;
      }
      await loadDashboardData();
    };

    loadWithResolvedId();

    // Set up real-time subscription for booking requests
    const subscribeToRequests = async () => {
      const vendorId = await resolveVendorId();
      if (!vendorId) return null;
      return supabase
        .channel('cook-chef-dashboard-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cook_chef_booking_requests',
            filter: `vendor_id=eq.${vendorId}`
          },
          () => {
            loadBookingRequests();
          }
        )
        .subscribe();
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    subscribeToRequests().then((createdChannel) => {
      channel = createdChannel || null;
    });

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadBookingRequests, loadDashboardData, resolveVendorId]);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      // When accepting, move to pending_confirmation where price can be confirmed
      const { error } = await supabase
        .from('cook_chef_booking_requests')
        .update({ status: 'pending_confirmation' })
        .eq('id', requestId);
      
      if (error) throw error;
      await loadBookingRequests();
      alert('Request accepted! Please review and confirm the price.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error accepting request:', error);
      alert('Failed to accept request: ' + errorMessage);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to decline this request?')) return;
    
    try {
      const { error } = await supabase
        .from('cook_chef_booking_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);
      
      if (error) throw error;
      await loadBookingRequests();
      alert('Request declined.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error declining request:', error);
      alert('Failed to decline request: ' + errorMessage);
    }
  };

  const handleConfirmPrice = async (requestId: string) => {
    if (!editedPrice || editedPrice <= 0) {
      alert('Please enter a valid price');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('cook_chef_booking_requests')
        .update({ 
          final_price: editedPrice,
          price_confirmed: true,
          status: 'pending_confirmation'
        })
        .eq('id', requestId);
      
      if (error) throw error;
      
      setEditingPrice(false);
      setSelectedRequest(null);
      await loadBookingRequests();
      alert('Price confirmed! Customer will be notified to proceed with payment.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error confirming price:', error);
      alert('Failed to confirm price: ' + errorMessage);
    }
  };

  const loadMessages = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from('cook_chef_messages')
        .select('*')
        .eq('booking_request_id', requestId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error loading messages:', error);
        return;
      }
      
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    const vendorId = await resolveVendorId();
    if (!selectedRequestForChat || !newMessage.trim() || !vendorId) return;
    
    try {
      const { error } = await supabase
        .from('cook_chef_messages')
        .insert({
          booking_request_id: selectedRequestForChat,
          sender_id: vendorId,
          message: newMessage.trim()
        });
      
      if (error) throw error;
      
      setNewMessage('');
      await loadMessages(selectedRequestForChat);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error sending message:', error);
      alert('Failed to send message: ' + errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-hospineil-base-bg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-hospineil-primary" />
      </div>
    );
  }

  const vendorName = vendor?.name || 'Cook/Chef';
  const pendingRequests = bookingRequests.filter(r => r.status === 'pending');
  const scheduledJobs = bookingRequests.filter(r => ['pending_confirmation', 'accepted', 'paid', 'completed'].includes(r.status));

  return (
    <div className="w-full min-h-screen bg-hospineil-base-bg">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-hospineil-primary mb-2 font-header">
              👋 Hello, <span className="text-hospineil-accent">{vendorName}</span>
            </h1>
            <p className="text-gray-600 font-body">
              Manage your cooking services, availability, and bookings
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button
              className="bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
              onClick={() => router.push("/vendor/subscription")}
            >
              Manage Subscription
            </Button>
          </div>
        </div>
      </div>

      {/* Payout + Commission Notice */}
      <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-900 font-body font-semibold mb-2">
              Action Required: Create Your Subaccount to Receive Payments
            </p>
            <p className="text-amber-800 font-body text-sm leading-relaxed">
              Please create your Paystack subaccount with accurate details from the Settings page. This is required to receive payouts for all orders.
            </p>
            <p className="text-amber-800 font-body text-sm leading-relaxed mt-2">
              Platform commission: <span className="font-semibold">10% per order</span> (deducted automatically).
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 flex-wrap border-b border-gray-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 font-button transition-colors ${
            activeTab === 'profile'
              ? 'border-b-2 border-hospineil-primary text-hospineil-primary font-semibold'
              : 'text-gray-600 hover:text-hospineil-primary'
          }`}
        >
          Service Profile
        </button>
        <button
          onClick={() => setActiveTab('availability')}
          className={`px-4 py-2 font-button transition-colors ${
            activeTab === 'availability'
              ? 'border-b-2 border-hospineil-primary text-hospineil-primary font-semibold'
              : 'text-gray-600 hover:text-hospineil-primary'
          }`}
        >
          Availability
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-button transition-colors relative ${
            activeTab === 'requests'
              ? 'border-b-2 border-hospineil-primary text-hospineil-primary font-semibold'
              : 'text-gray-600 hover:text-hospineil-primary'
          }`}
        >
          Incoming Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 font-button transition-colors ${
            activeTab === 'jobs'
              ? 'border-b-2 border-hospineil-primary text-hospineil-primary font-semibold'
              : 'text-gray-600 hover:text-hospineil-primary'
          }`}
        >
          Scheduled Jobs
          {scheduledJobs.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              {scheduledJobs.length}
            </span>
          )}
        </button>
      </div>

      {/* Service Profile Tab */}
      {activeTab === 'profile' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-header flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Service Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Image Upload */}
            <div>
              <Label className="font-body mb-2">Profile Image</Label>
              <div className="space-y-4">
                {imagePreview && (
                  <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-gray-200">
                    <Image
                      src={imagePreview}
                      alt="Profile preview"
                      fill
                      className="object-cover"
                      sizes="192px"
                    />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={uploadingImage}
                    className="font-body"
                  />
                  {uploadingImage && (
                    <Loader2 className="h-4 w-4 animate-spin text-hospineil-primary" />
                  )}
                </div>
                <p className="text-sm text-gray-500 font-body">
                  Upload a profile image that will be displayed on the explore page. Max size: 5MB
                </p>
              </div>
            </div>

            {/* Specialties */}
            <div>
              <Label className="font-body mb-2">Specialties</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  placeholder="e.g., Jollof Rice, Vegan Meals"
                  onKeyPress={(e) => e.key === 'Enter' && addSpecialty()}
                />
                <Button onClick={addSpecialty} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {serviceProfile.specialties.map((specialty, idx) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                    {specialty}
                    <button
                      onClick={() => removeSpecialty(specialty)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Pricing Model */}
            <div>
              <Label className="font-body mb-2">Pricing Model</Label>
              <Select
                value={serviceProfile.pricing_model}
                onValueChange={(value) => setServiceProfile({ 
                  ...serviceProfile, 
                  pricing_model: value as ServiceProfile["pricing_model"],
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_meal">Per Meal/Plate</SelectItem>
                  <SelectItem value="per_hour">Per Hour</SelectItem>
                  <SelectItem value="per_job">Per Job (Flat Rate)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Base Price */}
            <div>
              <Label className="font-body mb-2">Base Price (₦)</Label>
              <Input
                type="number"
                value={serviceProfile.base_price}
                onChange={(e) => setServiceProfile({ ...serviceProfile, base_price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            {/* Service Mode */}
            <div>
              <Label className="font-body mb-2">Service Mode</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceProfile.service_mode.includes('cook_and_deliver')}
                    onChange={() => toggleServiceMode('cook_and_deliver')}
                  />
                  <span className="font-body">Cook & Deliver</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceProfile.service_mode.includes('cook_at_customer_location')}
                    onChange={() => toggleServiceMode('cook_at_customer_location')}
                  />
                  <span className="font-body">Cook at Customer Location</span>
                </label>
              </div>
            </div>

            {/* Bio */}
            <div>
              <Label className="font-body mb-2">Bio/Description</Label>
              <Textarea
                value={serviceProfile.bio || ''}
                onChange={(e) => setServiceProfile({ ...serviceProfile, bio: e.target.value })}
                placeholder="Tell customers about your cooking style and experience..."
                rows={4}
              />
            </div>

            <Button
              onClick={saveServiceProfile}
              disabled={savingProfile}
              className="bg-hospineil-primary text-white"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Profile'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Availability Tab */}
      {activeTab === 'availability' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-header flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Availability Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add New Slot */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-hospineil-light-bg rounded-lg">
              <div>
                <Label className="font-body mb-2">Date</Label>
                <Input
                  type="date"
                  value={newSlot.date}
                  onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label className="font-body mb-2">Start Time</Label>
                <Input
                  type="time"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label className="font-body mb-2">End Time</Label>
                <Input
                  type="time"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addAvailabilitySlot}
                  disabled={savingAvailability}
                  className="w-full bg-hospineil-primary text-white"
                >
                  {savingAvailability ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Slot
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Availability Slots List */}
            <div className="space-y-2">
              {availabilitySlots.length === 0 ? (
                <p className="text-gray-500 text-center py-8 font-body">
                  No availability slots added. Add your available time slots above.
                </p>
              ) : (
                availabilitySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="h-5 w-5 text-hospineil-primary" />
                      <div>
                        <p className="font-semibold font-body">
                          {new Date(slot.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                        <p className="text-sm text-gray-600 font-body">
                          {slot.start_time} - {slot.end_time}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => slot.id && removeAvailabilitySlot(slot.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Incoming Requests Tab */}
      {activeTab === 'requests' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-header">Incoming Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-hospineil-primary" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8 font-body">
                No pending requests at the moment.
              </p>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-6 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold font-header mb-2">{request.customer_name}</h3>
                        <div className="space-y-1 text-sm text-gray-600 font-body">
                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {request.location}
                          </p>
                          <p className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {new Date(request.requested_date).toLocaleDateString()} at {request.requested_time}
                          </p>
                          <p className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {request.number_of_people} {request.number_of_people === 1 ? 'person' : 'people'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={request.status === 'pending' ? 'default' : 'secondary'}
                        className="font-button"
                      >
                        {request.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>

                    <div className="mb-4 p-4 bg-hospineil-light-bg rounded-lg">
                      <p className="font-semibold font-body mb-1">Meal Type: {request.meal_type}</p>
                      {request.special_instructions && (
                        <p className="text-sm text-gray-700 font-body mt-2">
                          <span className="font-semibold">Special Instructions:</span> {request.special_instructions}
                        </p>
                      )}
                      {(request.base_price || request.final_price) && (
                        <p className="text-sm text-gray-700 font-body mt-2">
                          <span className="font-semibold">Price:</span> ₦
                          {(request.final_price || request.base_price || 0).toLocaleString('en-NG', {
                            minimumFractionDigits: 2
                          })}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {request.status === 'pending' && (
                        <>
                          <Button
                            onClick={() => {
                              setSelectedRequest(request);
                              setEditedPrice(request.base_price || 0);
                              setEditingPrice(true);
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Review Price
                          </Button>
                          <Button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="bg-green-600 text-white hover:bg-green-700"
                            size="sm"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleDeclineRequest(request.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Decline
                          </Button>
                        </>
                      )}
                      {request.status === 'pending_confirmation' && !request.price_confirmed && (
                        <Button
                          onClick={() => handleConfirmPrice(request.id)}
                          className="bg-hospineil-primary text-white"
                          size="sm"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Confirm Price
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          setSelectedRequestForChat(request.id);
                          loadMessages(request.id);
                          setActiveTab('messages');
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Price Editing Modal */}
            {editingPrice && selectedRequest && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-xl font-semibold font-header mb-4">Edit Price</h3>
                  <div className="mb-4">
                    <Label className="font-body mb-2">Final Price (₦)</Label>
                    <Input
                      type="number"
                      value={editedPrice}
                      onChange={(e) => setEditedPrice(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1 font-body">
                      Original: ₦{(selectedRequest.base_price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleConfirmPrice(selectedRequest.id)}
                      className="flex-1 bg-hospineil-primary text-white"
                    >
                      Confirm
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingPrice(false);
                        setSelectedRequest(null);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scheduled Jobs Tab */}
      {activeTab === 'jobs' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-header">Scheduled Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledJobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8 font-body">
                No scheduled jobs at the moment.
              </p>
            ) : (
              <div className="space-y-4">
                {scheduledJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-6 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold font-header mb-2">{job.customer_name}</h3>
                        <div className="space-y-1 text-sm text-gray-600 font-body">
                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {job.location}
                          </p>
                          <p className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {new Date(job.requested_date).toLocaleDateString()} at {job.requested_time}
                          </p>
                          <p className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {job.number_of_people} {job.number_of_people === 1 ? 'person' : 'people'}
                          </p>
                          {job.final_price && (
                            <p className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              ₦{job.final_price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={
                          job.status === 'completed' ? 'default' :
                          job.status === 'paid' ? 'secondary' :
                          'outline'
                        }
                        className="font-button"
                      >
                        {job.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="p-4 bg-hospineil-light-bg rounded-lg mb-4">
                      <p className="font-semibold font-body mb-1">Meal Type: {job.meal_type}</p>
                      {job.special_instructions && (
                        <p className="text-sm text-gray-700 font-body mt-2">
                          <span className="font-semibold">Special Instructions:</span> {job.special_instructions}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedRequestForChat(job.id);
                        loadMessages(job.id);
                        setActiveTab('messages');
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message Customer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-header flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Messages
              {selectedRequestForChat && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRequestForChat(null);
                    setMessages([]);
                    setActiveTab('requests');
                  }}
                  className="ml-auto"
                >
                  Back to Requests
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRequestForChat ? (
              <p className="text-gray-500 text-center py-8 font-body">
                Select a request or job to view messages.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-4 bg-hospineil-light-bg">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-8 font-body">
                      No messages yet. Start the conversation!
                    </p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-3 rounded-lg ${
                          message.sender_id === vendor?.id
                            ? 'bg-hospineil-primary text-white ml-auto max-w-[80%]'
                            : 'bg-white border border-gray-200 max-w-[80%]'
                        }`}
                      >
                        <p className="font-body">{message.message}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender_id === vendor?.id ? 'text-white/80' : 'text-gray-500'
                        }`}>
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button
                    onClick={sendMessage}
                    className="bg-hospineil-primary text-white"
                  >
                    Send
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
