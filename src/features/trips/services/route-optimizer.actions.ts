'use server';

export interface RouteEstimation {
  success: boolean;
  originCoords?: { lat: number; lon: number };
  destCoords?: { lat: number; lon: number };
  distanceKm?: number;
  durationHours?: number;
  estimatedFuelCost?: number;
  estimatedTollCost?: number;
  ferryCost?: number;
  totalEstimatedCost?: number;
  suggestedPrice?: number;
  minProfitablePrice?: number;
  error?: string;
}

// ثوابت ومحددات التسعير اللوجستي للمنظومة
const AVG_FUEL_CONSUMPTION = 35; // لتر لكل 100 كم
const DIESEL_PRICE = 12.5; // الدرهم للتر
const TOLL_RATE_PER_KM = 0.8; // التكلفة التقديرية للطرق السريعة (درهم/كم)
const FERRY_COST_FLAT = 4500; // التكلفة التقديرية لعبور مضيق جبل طارق (MAD)

// دالة لجلب الإحداثيات الجغرافية عبر OpenStreetMap Nominatim
async function geocodeCity(city: string) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`, {
      headers: { 'User-Agent': 'TransBodanon-ERP/1.0' },
      next: { revalidate: 86400 } // تخزين النتيجة مؤقتاً ليوم كامل لتقليل الطلبات
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (err) {
    return null;
  }
}

export async function analyzeRouteProfitability(
  origin: string, 
  destination: string, 
  includeFerry: boolean = true
): Promise<RouteEstimation> {
  try {
    if (!origin || !destination) {
      return { success: false, error: 'يرجى تحديد مدينة الانطلاق والوجهة.' };
    }

    // 1. تحديد الإحداثيات
    const originCoords = await geocodeCity(origin);
    const destCoords = await geocodeCity(destination);

    if (!originCoords || !destCoords) {
      return { success: false, error: 'تعذر تحديد المواقع الجغرافية للمدن المدخلة.' };
    }

    // 2. حساب المسافة عبر محرك التوجيه المفتوح OSRM (الإحداثيات تمرر: خط الطول، خط العرض)
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    const routeRes = await fetch(osrmUrl);
    const routeData = await routeRes.json();

    if (routeData.code !== 'Ok' || !routeData.routes || routeData.routes.length === 0) {
      return { success: false, error: 'تعذر حساب المسار البري بدقة.' };
    }

    const distanceKm = routeData.routes[0].distance / 1000;
    const durationHours = routeData.routes[0].duration / 3600;

    // 3. التحليل المالي والتشغيلي
    const fuelCost = (distanceKm / 100) * AVG_FUEL_CONSUMPTION * DIESEL_PRICE;
    const tollCost = distanceKm * TOLL_RATE_PER_KM;
    const ferryCost = includeFerry ? FERRY_COST_FLAT : 0;
    
    // إضافة 20% كهامش أمان للمصاريف الطارئة (مصاريف السائق، غرامات محتملة، تقلبات أسعار)
    const totalEstimatedCost = (fuelCost + tollCost + ferryCost) * 1.2;

    // 4. تسعير الذكاء الاصطناعي اللوجستي
    const minProfitablePrice = totalEstimatedCost * 1.1; // السعر الأدنى المقبول (هامش 10%)
    const suggestedPrice = totalEstimatedCost * 1.25; // السعر المثالي المقترح (هامش 25%)

    return {
      success: true,
      originCoords,
      destCoords,
      distanceKm: Math.round(distanceKm),
      durationHours: Math.round(durationHours * 10) / 10,
      estimatedFuelCost: Math.round(fuelCost),
      estimatedTollCost: Math.round(tollCost),
      ferryCost,
      totalEstimatedCost: Math.round(totalEstimatedCost),
      // تقريب السعر لأقرب 100 درهم
      suggestedPrice: Math.round(suggestedPrice / 100) * 100, 
      minProfitablePrice: Math.round(minProfitablePrice / 100) * 100,
    };

  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ أثناء تحليل المسار' };
  }
}

