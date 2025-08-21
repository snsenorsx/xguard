import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Zap, Lock, BarChart3 } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10" />
        
        <div className="relative z-10 flex flex-col justify-center p-12 max-w-xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold">RPC Cloaker</h1>
            </div>
            
            <p className="text-xl text-muted-foreground mb-8">
              Advanced traffic management system with AI-powered bot detection
            </p>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-start space-x-4"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">
                  Sub-3ms bot detection with 99.9% accuracy
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-start space-x-4"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Enterprise Security</h3>
                <p className="text-sm text-muted-foreground">
                  Bank-grade encryption and security measures
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-start space-x-4"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Real-time Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor and optimize your traffic in real-time
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  )
}