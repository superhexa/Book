/**
 * Typed translation key structure for the Book i18n system.
 *
 * `Translations` mirrors the shape of `ar.ts` (and `en.ts`). Every locale
 * file must implement this interface so missing keys fail at build time.
 */

export type Locale = "ar-JO" | "en";

/** Interpolation variables supported by `t(key, defaultValue, vars)`. */
export type TranslationVars = Record<string, string | number>;

export interface I18nContextValue {
  /** Translate a dot-path key. Falls back to `defaultValue`, then the key itself. */
  t: (key: string, defaultValue?: string, vars?: TranslationVars) => string;
  /** Active locale, e.g. "ar-JO". */
  locale: Locale;
  /** Switch locale, persist it, and flip layout direction. */
  setLocale: (locale: Locale) => Promise<void>;
  /** True when the active locale is right-to-left. */
  isRTL: boolean;
}

interface Buttons {
  save: string;
  cancel: string;
  confirm: string;
  close: string;
  back: string;
  next: string;
  done: string;
  retry: string;
  search: string;
  filter: string;
  clear: string;
  apply: string;
  viewAll: string;
  bookNow: string;
  callNow: string;
  directions: string;
  edit: string;
  delete: string;
  add: string;
  refresh: string;
  send: string;
  submit: string;
  skip: string;
  ok: string;
  yes: string;
  no: string;
  seeMore: string;
  seeLess: string;
}

export interface Translations {
  common: {
    appName: string;
    tagline: string;
    buttons: Buttons;
    loading: string;
    saving: string;
    currency: string;
    perHour: string;
    free: string;
  };
  nav: {
    home: string;
    explore: string;
    bookings: string;
    favorites: string;
    profile: string;
    notifications: string;
    settings: string;
  };
  auth: {
    welcome: string;
    welcomeBack: string;
    login: string;
    register: string;
    logout: string;
    createAccount: string;
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    phone: string;
    phoneHint: string;
    forgotPassword: string;
    resetPassword: string;
    noAccount: string;
    haveAccount: string;
    continueAsGuest: string;
    verifyPhone: string;
    otpSent: string;
    resendCode: string;
    resendIn: string;
    agreeToTerms: string;
    errors: {
      invalidCredentials: string;
      accountLocked: string;
      accountDisabled: string;
      emailExists: string;
      phoneExists: string;
      weakPassword: string;
      sessionExpired: string;
      tooManyAttempts: string;
      invalidOtp: string;
      expiredOtp: string;
      unknown: string;
    };
  };
  home: {
    greetingMorning: string;
    greetingEvening: string;
    findPitch: string;
    searchHint: string;
    popular: string;
    nearby: string;
    topRated: string;
    browseGovernorates: string;
  };
  booking: {
    title: string;
    newBooking: string;
    steps: {
      selectPitch: string;
      selectDateTime: string;
      details: string;
      confirm: string;
    };
    selectDate: string;
    selectTime: string;
    today: string;
    tomorrow: string;
    availableSlots: string;
    noSlots: string;
    slotTaken: string;
    duration: string;
    minutes: string;
    players: string;
    notes: string;
    notesPlaceholder: string;
    priceBreakdown: string;
    basePrice: string;
    total: string;
    payAtVenue: string;
    confirmBooking: string;
    bookingConfirmed: string;
    bookingConfirmedDesc: string;
    bookingRef: string;
    myBookings: string;
    upcoming: string;
    past: string;
    cancelBooking: string;
    cancelConfirmTitle: string;
    cancelConfirmMsg: string;
    refundInfo: string;
    rebook: string;
    status: {
      pending: string;
      confirmed: string;
      cancelled: string;
      completed: string;
      noShow: string;
    };
  };
  facility: {
    details: string;
    description: string;
    amenities: string;
    reviews: string;
    writeReview: string;
    workingHours: string;
    location: string;
    contact: string;
    rules: string;
    verified: string;
    rating: string;
    ratingsCount: string;
    openNow: string;
    closed: string;
    fieldType: {
      indoor: string;
      outdoor: string;
    };
    pricePerHour: string;
    fromPrice: string;
    addToFavorites: string;
    removeFromFavorites: string;
  };
  fields: {
    name: string;
    fullName: string;
    email: string;
    phone: string;
    password: string;
    date: string;
    time: string;
    governorate: string;
    city: string;
    area: string;
    address: string;
    notes: string;
    searchPlaceholder: string;
    all: string;
    selectGovernorate: string;
  };
  validation: {
    required: string;
    invalidEmail: string;
    invalidPhone: string;
    passwordMin: string;
    passwordsMismatch: string;
    nameMin: string;
    otpLength: string;
  };
  errors: {
    network: string;
    server: string;
    notFound: string;
    unauthorized: string;
    forbidden: string;
    timeout: string;
    unknown: string;
    tryAgain: string;
    goBack: string;
  };
  empty: {
    noFacilities: string;
    noFacilitiesDesc: string;
    noBookings: string;
    noBookingsDesc: string;
    noFavorites: string;
    noFavoritesDesc: string;
    noNotifications: string;
    noNotificationsDesc: string;
    noResults: string;
    noResultsDesc: string;
    startExploring: string;
  };
  settings: {
    title: string;
    account: string;
    language: string;
    arabic: string;
    english: string;
    notifications: string;
    pushNotifications: string;
    bookingReminders: string;
    theme: string;
    light: string;
    dark: string;
    system: string;
    currency: string;
    region: string;
    about: string;
    privacyPolicy: string;
    terms: string;
    help: string;
    version: string;
    logout: string;
    logoutConfirm: string;
    deleteAccount: string;
  };
  notifications: {
    title: string;
    markAllRead: string;
    types: {
      bookingConfirmed: string;
      bookingCancelled: string;
      bookingReminder: string;
      general: string;
    };
  };
  profile: {
    title: string;
    editProfile: string;
    personalInfo: string;
    saveChanges: string;
    profileUpdated: string;
    myReviews: string;
  };
  geo: {
    selectGovernorate: string;
    nearMe: string;
    governorates: {
      amman: string;
      irbid: string;
      zarqa: string;
      balqa: string;
      mafraq: string;
      jerash: string;
      ajloun: string;
      madaba: string;
      karak: string;
      tafilah: string;
      maan: string;
      aqaba: string;
    };
  };
  time: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    yesterday: string;
    daysAgo: string;
    am: string;
    pm: string;
  };
}
