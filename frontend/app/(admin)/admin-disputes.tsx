import { PageHeader, PanelScreen, PendingFeature, useRtl } from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";

export default function AdminDisputes() {
  const { t } = useTranslation();
  useRtl();
  return (
    <PanelScreen testID="admin-disputes">
      <PageHeader
        title={t("ad.title", "النزاعات")}
        subtitle={t("ad.sub", "مراجعة وحل النزاعات بين اللاعبين والملاك")}
      />
      <PendingFeature
        title={t("ad.soon", "مركز النزاعات قريباً")}
        body={t("ad.body", "ستظهر هنا النزاعات المفتوحة مع إمكانية مراجعة الأدلة واتخاذ قرار نهائي.")}
        needed={[
          "GET /api/admin/disputes?status=open",
          "GET /api/admin/disputes/{id}",
          "POST /api/admin/disputes/{id}/resolve",
        ]}
      />
    </PanelScreen>
  );
}
