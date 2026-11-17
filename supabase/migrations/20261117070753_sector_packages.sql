-- Sektör paketleri: kozmetik, kurs/eğitim, emlak, finans.
-- Dört tablodaki sektör kısıtı yedi sektörle yeniden kuruluyor.

alter table public.profiles drop constraint if exists profiles_default_sector_check;
alter table public.profiles add constraint profiles_default_sector_check
  check (default_sector in ('genel','takviye_gida','estetik_klinik','kozmetik','kurs_egitim','emlak','finans'));

alter table public.brands drop constraint if exists brands_sector_check;
alter table public.brands add constraint brands_sector_check
  check (sector in ('genel','takviye_gida','estetik_klinik','kozmetik','kurs_egitim','emlak','finans'));

alter table public.rule_cards drop constraint if exists rule_cards_sector_check;
alter table public.rule_cards add constraint rule_cards_sector_check
  check (sector in ('genel','takviye_gida','estetik_klinik','kozmetik','kurs_egitim','emlak','finans'));

alter table public.analyses drop constraint if exists analyses_sector_check;
alter table public.analyses add constraint analyses_sector_check
  check (sector in ('genel','takviye_gida','estetik_klinik','kozmetik','kurs_egitim','emlak','finans'));
