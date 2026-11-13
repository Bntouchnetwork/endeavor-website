/* Endeavor portal configuration (public values only — data is protected by row-level security in Supabase). */
window.ENDEAVOR_CFG = {
  supabaseUrl: 'https://onaewjlozioderwlvgfm.supabase.co',
  supabaseKey: 'sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO',
  functionsUrl: 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1',
  formEndpoint: 'https://formsubmit.co/ajax/support@endeavorbiz.com',
  adminEmail: 'support@endeavorbiz.com',
  companyName: 'Endeavor Business Solutions'
};

/* Language by the visitor's country (from the device time zone): English in the U.S., Portuguese in Brazil (and Portugal),
   Spanish in Spanish-speaking countries. Used only when there is no ?lang= and no language chosen before. */
window.ENDEAVOR_GEO_LANG = function () {
  var z = '';
  try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return null; }
  if (/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Maceio|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Santarem|Noronha|Eirunepe)$|^Europe\/Lisbon$|^Atlantic\/(Azores|Madeira)$|^Africa\/(Luanda|Maputo)$/.test(z)) return 'pt';
  if (/^America\/(Asuncion|Argentina\/.*|Buenos_Aires|Cordoba|Mendoza|Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Hermosillo|Mazatlan|Bahia_Banderas|Tijuana|Bogota|Lima|Santiago|Punta_Arenas|Montevideo|La_Paz|Guayaquil|Caracas|Panama|Costa_Rica|Guatemala|El_Salvador|Tegucigalpa|Managua|Havana|Santo_Domingo|Puerto_Rico)$|^Pacific\/(Galapagos|Easter)$|^Europe\/Madrid$|^Atlantic\/Canary$|^Africa\/(Ceuta|Malabo)$/.test(z)) return 'es';
  if (/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak|Boise|Detroit|Menominee|Indiana\/.*|Kentucky\/.*|North_Dakota\/.*)|Pacific\/Honolulu|US\/.*)$/.test(z)) return 'en';
  return null;
};
