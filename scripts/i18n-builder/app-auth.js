module.exports = {
  app: {
    title: 'Sistema de Gestión de Transporte Internacional',
    dashboard: {
      title: 'Panel de Control',
      welcome: 'Bienvenido',
      stats: {
        totalTrips: 'Total de Viajes',
        totalRevenue: 'Ingresos Totales',
        activeDrivers: 'Conductores Activos',
        fleetHealth: 'Estado de la Flota'
      }
    },
    trips: {
      title: 'Viajes',
      createTrip: 'Crear Viaje',
      outbound: 'Ida',
      return: 'Vuelta',
      status: {
        pending: 'Pendiente',
        in_progress: 'En Curso',
        completed: 'Completado',
        settled: 'Liquidado'
      }
    },
    treasury: {
      title: 'Tesorería',
      balance: 'Saldo',
      transactions: 'Transacciones',
      type: {
        trip_expense: 'Gasto de Viaje',
        trip_revenue: 'Ingreso de Viaje',
        office_expense: 'Gasto de Oficina'
      }
    },
    clients: {
      title: 'Clientes',
      name: 'Nombre',
      phone: 'Teléfono',
      email: 'Correo Electrónico',
      createClient: 'Añadir Cliente'
    },
    invoices: {
      title: 'Facturas',
      createInvoice: 'Crear Factura',
      status: {
        paid: 'Pagada',
        partially_paid: 'Parcialmente Pagada',
        unpaid: 'No Pagada'
      }
    },
    documents: {
      title: 'Documentos',
      expiryAlert: 'Alerta de Vencimiento',
      renew: 'Renovar',
      quickRenew: 'Renovación Rápida',
      renewalCost: 'Costo de Renovación'
    },
    drivers: {
      title: 'Conductores',
      name: 'Nombre',
      phone: 'Teléfono',
      status: 'Estado',
      baseSalary: 'Salario Base',
      bonusPercentage: 'Porcentaje de Bonificación'
    },
    auth: {
      login: 'Iniciar Sesión',
      logout: 'Cerrar Sesión',
      email: 'Correo Electrónico',
      password: 'Contraseña',
      signup: 'Registrarse',
      forgotPassword: '¿Olvidó su contraseña?'
    },
    settings: {
      title: 'Configuración',
      company: 'Empresa y Apariencia',
      users: 'Usuarios y Permisos',
      language: 'Idioma',
      theme: 'Tema',
      dark: 'Oscuro',
      light: 'Claro',
      system: 'Sistema'
    },
    common: {
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      search: 'Buscar',
      filter: 'Filtrar',
      actions: 'Acciones',
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      confirm: 'Confirmar',
      close: 'Cerrar',
      back: 'Volver',
      next: 'Siguiente',
      previous: 'Anterior',
      yes: 'Sí',
      no: 'No',
      noData: 'Sin datos disponibles',
      currency: 'Moneda',
      date: 'Fecha',
      amount: 'Monto',
      description: 'Descripción',
      notes: 'Notas',
      reference: 'Referencia',
      status: 'Estado',
      type: 'Tipo'
    }
  },
  auth: {
    signInTitle: 'Iniciar Sesión',
    signUpTitle: 'Crear Cuenta Nueva',
    signUpDescription: 'Ingrese sus datos para unirse al sistema Trans Bodanon',
    signInDescription: 'Ingrese sus credenciales para acceder a su cuenta',
    fullName: 'Nombre Completo',
    fullNamePlaceholder: 'Ej. Juan Pérez',
    emailPlaceholder: 'correo@ejemplo.com',
    passwordPlaceholder: '••••••••',
    forgotPasswordLink: '¿Olvidó su contraseña?',
    noAccount: '¿No tiene una cuenta?',
    hasAccount: '¿Ya tiene una cuenta?',
    signUpLink: 'Crear una cuenta',
    signInLink: 'Iniciar sesión',
    createAccount: 'Crear Cuenta',
    signInButton: 'Iniciar Sesión',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    emailVerificationRequired: 'Se requiere verificación de correo electrónico',
    resendVerificationEmail: 'Reenviar correo de verificación',
    verificationEmailSent: 'Se ha enviado el correo de verificación',
    checkYourEmail: 'Por favor, revise su bandeja de entrada para verificar su correo',
    resetPasswordInstructions: 'Ingrese su correo y le enviaremos un enlace para restablecer su contraseña',
    sendResetLink: 'Enviar Enlace de Restablecimiento',
    backToLogin: 'Volver al inicio de sesión',
    createAccountSuccess: 'Cuenta creada con éxito',
    createAccountSuccessDesc: 'Su cuenta ha sido creada exitosamente. Ahora puede iniciar sesión.',
    signInError: 'Error al iniciar sesión',
    invalidLogin: 'Correo electrónico o contraseña no válidos'
  }
};

