// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Tailwind CSS class merging utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date formatting utilities
export const dateUtils = {
  /**
   * Formatea una fecha a formato legible
   */
  format: (date: string | Date, formatStr: string = "PPP") => {
    try {
      const parsedDate = typeof date === "string" ? parseISO(date) : date;
      if (!isValid(parsedDate)) return "Fecha inválida";
      return format(parsedDate, formatStr, { locale: es });
    } catch {
      return "Fecha inválida";
    }
  },

  /**
   * Formatea fecha relativa (hace X tiempo)
   */
  formatRelative: (date: string | Date) => {
    try {
      const parsedDate = typeof date === "string" ? parseISO(date) : date;
      if (!isValid(parsedDate)) return "Fecha inválida";
      return formatDistanceToNow(parsedDate, { addSuffix: true, locale: es });
    } catch {
      return "Fecha inválida";
    }
  },

  /**
   * Verifica si una fecha está vencida
   */
  isOverdue: (date: string | Date) => {
    try {
      const parsedDate = typeof date === "string" ? parseISO(date) : date;
      if (!isValid(parsedDate)) return false;
      return parsedDate < new Date();
    } catch {
      return false;
    }
  },

  /**
   * Obtiene el color de prioridad según proximidad de vencimiento
   */
  getDueDateColor: (date: string | Date) => {
    try {
      const parsedDate = typeof date === "string" ? parseISO(date) : date;
      if (!isValid(parsedDate)) return "text-muted-foreground";
      
      const now = new Date();
      const diffHours = (parsedDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (diffHours < 0) return "text-destructive"; // Vencida
      if (diffHours < 24) return "text-orange-500"; // Menos de 24h
      if (diffHours < 72) return "text-yellow-500"; // Menos de 3 días
      return "text-muted-foreground"; // Normal
    } catch {
      return "text-muted-foreground";
    }
  }
};

// String utilities
export const stringUtils = {
  /**
   * Capitaliza la primera letra
   */
  capitalize: (str: string) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Trunca texto con ellipsis
   */
  truncate: (str: string, length: number = 50) => {
    if (!str) return "";
    if (str.length <= length) return str;
    return str.slice(0, length) + "...";
  },

  /**
   * Genera initiales desde un nombre
   */
  getInitials: (name: string) => {
    if (!name) return "NN";
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  },

  /**
   * Slugifica un string
   */
  slugify: (str: string) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
};

// Validation utilities
export const validationUtils = {
  /**
   * Valida email
   */
  isValidEmail: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Valida contraseña fuerte
   */
  isStrongPassword: (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  },

  /**
   * Obtiene la fuerza de la contraseña
   */
  getPasswordStrength: (password: string) => {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    if (score <= 2) return { strength: "débil", color: "text-red-500" };
    if (score <= 3) return { strength: "media", color: "text-yellow-500" };
    if (score <= 4) return { strength: "fuerte", color: "text-green-500" };
    return { strength: "muy fuerte", color: "text-green-600" };
  }
};

// Task utilities
export const taskUtils = {
  /**
   * Obtiene el color del estado de tarea
   */
  getStatusColor: (status: string) => {
    const colors = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
      IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
      COMPLETED: "bg-green-100 text-green-800 border-green-200",
      CANCELLED: "bg-red-100 text-red-800 border-red-200",
      ON_HOLD: "bg-gray-100 text-gray-800 border-gray-200"
    };
    return colors[status as keyof typeof colors] || colors.PENDING;
  },

  /**
   * Obtiene el color de prioridad
   */
  getPriorityColor: (priority: string) => {
    const colors = {
      LOW: "bg-gray-100 text-gray-700 border-gray-200",
      MEDIUM: "bg-blue-100 text-blue-700 border-blue-200",
      HIGH: "bg-orange-100 text-orange-700 border-orange-200",
      URGENT: "bg-red-100 text-red-700 border-red-200"
    };
    return colors[priority as keyof typeof colors] || colors.MEDIUM;
  },

  /**
   * Obtiene el peso numérico de prioridad para ordenamiento
   */
  getPriorityWeight: (priority: string) => {
    const weights = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return weights[priority as keyof typeof weights] || 2;
  },

  /**
   * Formatea el estado para mostrar
   */
  formatStatus: (status: string) => {
    const statusMap = {
      PENDING: "Pendiente",
      IN_PROGRESS: "En Progreso",
      COMPLETED: "Completada",
      CANCELLED: "Cancelada",
      ON_HOLD: "En Espera"
    };
    return statusMap[status as keyof typeof statusMap] || status;
  },

  /**
   * Formatea la prioridad para mostrar
   */
  formatPriority: (priority: string) => {
    const priorityMap = {
      LOW: "Baja",
      MEDIUM: "Media",
      HIGH: "Alta",
      URGENT: "Urgente"
    };
    return priorityMap[priority as keyof typeof priorityMap] || priority;
  }
};

// Storage utilities
export const storageUtils = {
  /**
   * Obtiene item del localStorage con manejo de errores
   */
  getItem: (key: string, defaultValue: any = null) => {
    if (typeof window === "undefined") return defaultValue;
    
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  },

  /**
   * Guarda item en localStorage
   */
  setItem: (key: string, value: any) => {
    if (typeof window === "undefined") return false;
    
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Elimina item del localStorage
   */
  removeItem: (key: string) => {
    if (typeof window === "undefined") return false;
    
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Limpia todo el localStorage
   */
  clear: () => {
    if (typeof window === "undefined") return false;
    
    try {
      window.localStorage.clear();
      return true;
    } catch {
      return false;
    }
  }
};

// URL utilities
export const urlUtils = {
  /**
   * Construye query string desde objeto
   */
  buildQueryString: (params: Record<string, any>) => {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
  },

  /**
   * Parse query string a objeto
   */
  parseQueryString: (search: string) => {
    const params = new URLSearchParams(search);
    const result: Record<string, any> = {};
    
    for (const [key, value] of params.entries()) {
      if (result[key]) {
        if (Array.isArray(result[key])) {
          result[key].push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
};

// Error utilities
export const errorUtils = {
  /**
   * Extrae mensaje de error legible
   */
  getErrorMessage: (error: any) => {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    if (error?.data?.message) return error.data.message;
    if (error?.response?.data?.message) return error.response.data.message;
    return "Ha ocurrido un error inesperado";
  },

  /**
   * Obtiene código de error
   */
  getErrorCode: (error: any) => {
    if (error?.code) return error.code;
    if (error?.data?.error?.code) return error.data.error.code;
    if (error?.response?.data?.error?.code) return error.response.data.error.code;
    if (error?.response?.status) return `HTTP_${error.response.status}`;
    return "UNKNOWN_ERROR";
  },

  /**
   * Determina si el error es de red
   */
  isNetworkError: (error: any) => {
    return (
      error?.code === "NETWORK_ERROR" ||
      error?.message?.includes("Network Error") ||
      error?.message?.includes("fetch") ||
      !navigator.onLine
    );
  },

  /**
   * Determina si el error es de autenticación
   */
  isAuthError: (error: any) => {
    const authCodes = ["TOKEN_EXPIRED", "TOKEN_INVALID", "UNAUTHORIZED"];
    const errorCode = errorUtils.getErrorCode(error);
    return authCodes.includes(errorCode) || error?.response?.status === 401;
  }
};

// Performance utilities
export const performanceUtils = {
  /**
   * Debounce function
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },

  /**
   * Throttle function
   */
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), delay);
      }
    };
  }
};

// Array utilities
export const arrayUtils = {
  /**
   * Agrupa array por campo
   */
  groupBy: <T>(array: T[], key: keyof T) => {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },

  /**
   * Remueve duplicados por campo
   */
  uniqueBy: <T>(array: T[], key: keyof T) => {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  },

  /**
   * Ordena array por múltiples campos
   */
  sortBy: <T>(array: T[], fields: Array<{ key: keyof T; order?: "asc" | "desc" }>) => {
    return [...array].sort((a, b) => {
      for (const field of fields) {
        const { key, order = "asc" } = field;
        const aVal = a[key];
        const bVal = b[key];
        
        if (aVal < bVal) return order === "asc" ? -1 : 1;
        if (aVal > bVal) return order === "asc" ? 1 : -1;
      }
      return 0;
    });
  }
};

// Export all utilities
export default {
  cn,
  dateUtils,
  stringUtils,
  validationUtils,
  taskUtils,
  storageUtils,
  urlUtils,
  errorUtils,
  performanceUtils,
  arrayUtils
};