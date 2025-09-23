set @oLicense = '0';
call bdKaizen.spDaIssueLicense('KZN', 'tenant-005', '2025-09-21 13:16:00', 'jM8N/jRNbs4vYmjOuHFDV/PSU6D/G7gdBAU/bHSuTZU=', @oLicense);
select @oLicense;

