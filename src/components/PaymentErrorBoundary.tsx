"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class PaymentErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Payment Error Boundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Redirect to a safe page
    if (typeof window !== "undefined") {
      window.location.href = "/orders";
    }
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
              <CardTitle className="text-center text-red-800">
                Something Went Wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 text-center">
                We encountered an error processing your payment. Don&apos;t worry - your payment was successful.
              </p>
              {this.state.error && (
                <div className="bg-white rounded p-3 text-xs text-gray-600 font-mono overflow-auto max-h-32">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={this.handleReset}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Go to Orders
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.href = "/";
                    }
                  }}
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PaymentErrorBoundary;





