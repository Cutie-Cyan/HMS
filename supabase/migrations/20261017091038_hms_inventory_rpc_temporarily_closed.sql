-- Close the original catalog RPC until a null-role-safe version is installed.
revoke execute on function public.staff_inventory_catalog(public.request_type) from authenticated;