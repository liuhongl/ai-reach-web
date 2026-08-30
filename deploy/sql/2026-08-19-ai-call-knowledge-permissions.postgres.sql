-- AI Reach 知识库最小权限。可重复执行。
-- 本期只创建可分配的权限点，不写 sys_role_menu；超级管理员继续使用 RuoYi 的 *:*:* 权限。

BEGIN;

-- sys_menu 没有序列；短暂阻止并发写入，确保 MAX(menu_id) + 1 不冲突。
LOCK TABLE sys_menu IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    knowledge_parent_id bigint;
    knowledge_menu_id bigint;
BEGIN
    SELECT COALESCE((
        SELECT parent_id
        FROM sys_menu
        WHERE perms = 'ai_call:prompt:manage'
        ORDER BY menu_id
        LIMIT 1
    ), 0)
    INTO knowledge_parent_id;

    IF NOT EXISTS (
        SELECT 1 FROM sys_menu WHERE perms = 'ai_call:knowledge:view'
    ) THEN
        SELECT COALESCE(MAX(menu_id), 0) + 1
        INTO knowledge_menu_id
        FROM sys_menu;

        INSERT INTO sys_menu (
            menu_id, menu_name, parent_id, order_num, path, component, query_param,
            is_frame, is_cache, menu_type, visible, status, perms, icon,
            create_dept, create_by, create_time, remark, portal_scope
        ) VALUES (
            knowledge_menu_id, '知识库查看', knowledge_parent_id, 1, '#', '', '',
            '1', '0', 'F', '1', '0', 'ai_call:knowledge:view', '#',
            103, 1, CURRENT_TIMESTAMP, 'AI Reach 知识库只读权限', 'PRODUCT'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sys_menu WHERE perms = 'ai_call:knowledge:manage'
    ) THEN
        SELECT COALESCE(MAX(menu_id), 0) + 1
        INTO knowledge_menu_id
        FROM sys_menu;

        INSERT INTO sys_menu (
            menu_id, menu_name, parent_id, order_num, path, component, query_param,
            is_frame, is_cache, menu_type, visible, status, perms, icon,
            create_dept, create_by, create_time, remark, portal_scope
        ) VALUES (
            knowledge_menu_id, '知识库管理', knowledge_parent_id, 2, '#', '', '',
            '1', '0', 'F', '1', '0', 'ai_call:knowledge:manage', '#',
            103, 1, CURRENT_TIMESTAMP, 'AI Reach 知识库写入和场景绑定权限', 'PRODUCT'
        );
    END IF;

    IF EXISTS (
        SELECT expected.perms
        FROM (VALUES
            ('ai_call:knowledge:view'),
            ('ai_call:knowledge:manage')
        ) AS expected(perms)
        LEFT JOIN sys_menu menu_row ON menu_row.perms = expected.perms
        GROUP BY expected.perms
        HAVING COUNT(menu_row.menu_id) <> 1
    ) THEN
        RAISE EXCEPTION '知识库权限点缺失或重复';
    END IF;
END $$;

COMMIT;
