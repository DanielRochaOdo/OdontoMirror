import { supabase } from './supabase';

export async function assignWhatsAppVendor(whatsappAccountId: string, vendorId: string) {
  const { error } = await supabase.rpc('admin_assign_whatsapp_vendor', {
    p_whatsapp_account_id: whatsappAccountId,
    p_vendor_id: vendorId,
  });
  if (error) throw error;
}

export async function unlinkWhatsAppVendor(whatsappAccountId: string) {
  const { error } = await supabase.rpc('admin_unlink_whatsapp_vendor', {
    p_whatsapp_account_id: whatsappAccountId,
  });
  if (error) throw error;
}
