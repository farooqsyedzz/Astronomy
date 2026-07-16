const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: moduleRuns, error } = await supabase
    .from('qa_module_runs')
    .select('module_name, auto_fix')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('Module Runs:', JSON.stringify(moduleRuns, null, 2));
  if (error) console.log('Error:', error);
}

run();
