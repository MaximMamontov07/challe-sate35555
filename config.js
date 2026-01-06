// Конфигурация Supabase
const SUPABASE_URL = 'https://xuoswaxjwqsnyawflrin.supabase.co'; // ЗАМЕНИТЕ на ваш URL
const SUPABASE_ANON_KEY = 'sb_publishable_MQNGdTJbt7pE8QNtjbLP-A_FVlCfSjp'; // ЗАМЕНИТЕ на ваш ключ

// Инициализация клиента Supabase
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase инициализирован');