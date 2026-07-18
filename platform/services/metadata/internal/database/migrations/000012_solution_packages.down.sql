DROP POLICY IF EXISTS solution_package_components_tenant_isolation ON solution_package_components;
ALTER TABLE solution_package_components DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS solution_package_components;

DROP POLICY IF EXISTS solution_packages_tenant_isolation ON solution_packages;
ALTER TABLE solution_packages DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS solution_packages;
