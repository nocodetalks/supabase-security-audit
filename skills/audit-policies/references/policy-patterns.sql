-- PATTERN A: User-Owned Data (most common, requires user_id column)
CREATE POLICY "Users can view own data" ON public.<table>
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own data" ON public.<table>
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own data" ON public.<table>
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own data" ON public.<table>
    FOR DELETE USING (auth.uid() = user_id);

-- PATTERN B: Public Read, Authenticated Write
CREATE POLICY "Anyone can read" ON public.<table>
    FOR SELECT USING (true);
CREATE POLICY "Auth users can insert" ON public.<table>
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- PATTERN C: Role-Based Access (admin)
CREATE POLICY "Admin full access" ON public.<table>
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- PATTERN D: Organization/Team-Based
CREATE POLICY "Team members access" ON public.<table>
    FOR SELECT USING (
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    );

-- PATTERN E: Deny All (internal tables)
CREATE POLICY "Deny all" ON public.<table> FOR ALL USING (false);

-- PATTERN F: Time-Based Access
CREATE POLICY "Recent records only" ON public.<table>
    FOR SELECT USING (created_at > now() - interval '30 days' AND auth.uid() = user_id);
