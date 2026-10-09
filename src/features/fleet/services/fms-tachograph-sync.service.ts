import type { TachographActivityType } from '../types/tachograph.types';
import type { FmsTachographRawPacket, FmsTachographSyncResult } from '../types/fms-tachograph.types';

export class FmsTachographSyncService {
  /**
   * تحويل حالة SPN 1612 القياسية إلى نوع النشاط المعتمد في نظام التاكوغراف
   * 00 = rest (راحة / استراحة)
   * 01 = available (جاهزية / متاح)
   * 10 = work (عمل آخر / تحميل / جمارك)
   * 11 = drive (قيادة فعلية)
   */
  public static mapWorkingStateToActivity(state: string): TachographActivityType {
    switch (state) {
      case '00':
        return 'rest';
      case '01':
        return 'available';
      case '10':
        return 'work';
      case '11':
      default:
        return 'drive';
    }
  }

  /**
   * معالجة حزمة TCO1 مع تطبيق قاعدة منع التلاعب والامتثال الصارم (Auto-Drive Override)
   * وفقاً للائحة الأوروبية EU Regulation 165/2014 & EC 561/2006:
   * إذا تجاوزت سرعة المركبة المقاسة عبر التاكوغراف أو ناقل CAN-Bus سرعة 1.0 كم/ساعة،
   * يُلزم النظام بنشاط 'drive' تلقائياً حتى لو اختار السائق يدوياً الراحة أو الجاهزية.
   */
  public static parseTco1Packet(
    packet: FmsTachographRawPacket,
    resolvedDriverId: string
  ): FmsTachographSyncResult {
    const isMoving = Number(packet.tachographVehicleSpeedKmh) > 1.0;
    const baseActivity = this.mapWorkingStateToActivity(packet.driverWorkingState);

    const activityType: TachographActivityType = isMoving ? 'drive' : baseActivity;

    return {
      vehicleId: packet.vehicleId,
      driverId: resolvedDriverId,
      activityType,
      speedKmh: packet.tachographVehicleSpeedKmh,
      isAutoSpeedOverride: isMoving && baseActivity !== 'drive',
      timestamp: packet.timestamp,
    };
  }
}

