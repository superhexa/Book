import { PageHeader, PanelScreen, PendingFeature, useRtl } from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";

export default function AdminLeagues() {
  const { t } = useTranslation();
  useRtl();
  return (
    <PanelScreen testID="admin-leagues">
      <PageHeader
        title={t("al.title", "الدوريات والمواسم")}
        subtitle={t("al.sub", "إدارة المسابقات والفرق والمباريات")}
      />
      <PendingFeature
        title={t("al.soon", "إدارة الدوريات قريباً")}
        body={t("al.body", "ستتمكن من إنشاء الدوريات والمواسم، تسجيل الفرق، توليد المباريات، وإدارة الترتيب من هنا.")}
        needed={[
          "GET /api/admin/leagues", "POST /api/admin/leagues", "PATCH /api/admin/leagues/{id}",
          "GET /api/admin/leagues/{id}/seasons", "POST /api/admin/seasons/{id}/fixtures",
          "GET /api/admin/matches", "PATCH /api/admin/matches/{id}",
          "GET /api/admin/standings?season_id=…",
        ]}
      />
    </PanelScreen>
  );
}
