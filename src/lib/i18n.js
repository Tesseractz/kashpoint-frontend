import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// English translations
const en = {
  translation: {
    // Common
    app_name: 'KashPoint',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    actions: 'Actions',
    confirm: 'Confirm',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    
    // Navigation
    nav: {
      dashboard: 'Dashboard',
      transactions: 'Transactions',
      products: 'Products',
      sell: 'Sell',
      customers: 'Customers',
      expenses: 'Expenses',
      users: 'Team',
      privacy: 'Privacy & Security',
      reports: 'Reports',
      analytics: 'Analytics',
      billing: 'Billing',
      profile: 'Profile & Settings',
      sign_out: 'Sign out',
      light_mode: 'Light Mode',
      dark_mode: 'Dark Mode',
    },
    
    // Profile
    profile: {
      title: 'Profile & Settings',
      subtitle: 'Manage your account and preferences',
      account_info: 'Account Information',
      subscription: 'Subscription',
      manage_plan: 'Manage your plan and billing',
      security: 'Security',
      security_desc: 'Manage your password and security settings',
      preferences: 'Preferences',
      danger_zone: 'Danger Zone',
      danger_desc: 'Irreversible and destructive actions',
    },
    
    // Auth
    auth: {
      sign_in: 'Sign In',
      sign_up: 'Create Account',
      sign_out: 'Sign Out',
      email: 'Email',
      password: 'Password',
      confirm_password: 'Confirm Password',
      store_name: 'Store Name',
      forgot_password: 'Forgot password?',
      no_account: "Don't have an account? Create one",
      have_account: 'Already have an account? Sign in',
      welcome_back: 'Welcome back! Sign in to continue',
      create_account: 'Create your account to get started',
      check_email: 'Check your email',
      email_sent: "We've sent a confirmation link to",
      reset_sent: "We've sent a password reset link to",
      click_to_activate: 'Click the link in the email to activate your account.',
      click_to_reset: 'Click the link in the email to reset your password.',
      back_to_signin: 'Back to Sign In',
      send_reset_link: 'Send Reset Link',
      update_password: 'Update Password',
      new_password: 'New Password',
      confirm_new_password: 'Confirm New Password',
      session_trouble: 'Having trouble? Clear session and try again',
      powered_by: 'Powered by FastAPI + React + Supabase',
    },
    
    // Products
    products: {
      title: 'Products',
      add_product: 'Add Product',
      edit_product: 'Edit Product',
      product_name: 'Product Name',
      product_code: 'Product Code',
      price: 'Price',
      quantity: 'Quantity',
      cost_price: 'Cost Price',
      no_products: 'No products found',
      delete_confirm: 'Are you sure you want to delete this product?',
      search_placeholder: 'Search products...',
      low_stock: 'Low Stock',
      out_of_stock: 'Out of Stock',
      in_stock: 'In Stock',
    },
    
    // Sell
    sell: {
      title: 'Sell',
      select_product: 'Select Product',
      quantity: 'Quantity',
      total: 'Total',
      complete_sale: 'Complete Sale',
      sale_success: 'Sale completed successfully!',
      insufficient_stock: 'Insufficient stock',
      recent_sales: 'Recent Sales',
    },
    
    // Reports
    reports: {
      title: 'Reports',
      daily_report: 'Daily Report',
      select_date: 'Select Date',
      total_sales: 'Total Sales',
      total_revenue: 'Total Revenue',
      total_profit: 'Total Profit',
      transactions: 'Transactions',
      no_transactions: 'No transactions for this date',
      export_csv: 'Export CSV',
    },
    
    // Analytics
    analytics: {
      title: 'Analytics',
      period: 'Period',
      days: 'days',
      revenue: 'Revenue',
      profit: 'Profit',
      sales_count: 'Sales Count',
      avg_transaction: 'Avg Transaction',
      profit_margin: 'Profit Margin',
      best_day: 'Best Day',
      worst_day: 'Worst Day',
      top_products: 'Top Products',
      sales_trends: 'Sales Trends',
      hourly_breakdown: 'Hourly Breakdown',
    },
    
    // Billing
    billing: {
      title: 'Choose Your Plan',
      subtitle: 'One plan. Full access. Your first 30 days are free — no card needed to start.',
      current_plan: 'Current Plan',
      trial_days_left: 'Trial: {{days}} days left',
      active: 'Active',
      payment_failed: 'Payment Failed',
      canceled: 'Canceled',
      no_active_plan: 'No Active Plan',
      manage_subscription: 'Manage Subscription',
      start_trial: 'Subscribe',
      switch_plan: 'Switch Plan',
      current: 'Current',
      most_popular: 'Most Popular',
      whats_included: "What's included:",
      contact_sales: 'Need a custom plan for your enterprise?',
      contact_team: 'Contact our sales team',
      next_billing: 'Next billing date',
      trial_ends: 'Trial ends',
      free: {
        name: 'Free',
        price: 'R0',
        period: '/forever',
        description: 'Get started for free',
        features: [
          'Up to 10 products',
          '1 team member',
          'Basic POS & sales',
          'View reports',
        ],
      },
      free: {
        name: 'Free',
        price: 'R0',
        period: '/forever',
        description: 'Get started for free',
        features: [
          'Up to 10 products',
          '1 team member',
          'Basic POS & sales',
        ],
      },
      pro: {
        name: 'Pro',
        price: 'R150',
        period: '/month',
        description: 'For growing businesses',
        features: [
          'Unlimited products',
          'Up to 3 team members',
          'Advanced analytics',
          'Low stock alerts',
          'CSV export',
        ],
      },
      business: {
        name: 'Business',
        price: 'R220',
        period: '/month',
        description: 'For larger operations',
        features: [
          'Everything in Pro',
          'Unlimited team members',
          'Audit logs',
        ],
      },
    },
    
    // Alerts
    alerts: {
      low_stock_title: 'Low Stock Alerts',
      threshold: 'Threshold',
      items_below: 'items below threshold',
    },
    
    // Errors
    errors: {
      generic: 'Something went wrong',
      network: 'Network error. Please try again.',
      unauthorized: 'Please sign in to continue',
      forbidden: 'You do not have permission to do this',
      not_found: 'Not found',
    },
    
    // Success messages
    success: {
      saved: 'Saved successfully',
      deleted: 'Deleted successfully',
      updated: 'Updated successfully',
    },
  },
}

i18n.use(initReactI18next).init({
  resources: {
    en,
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

// Save language preference
export const changeLanguage = (lang) => {
  i18n.changeLanguage(lang)
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', lang)
  }
}

export default i18n

