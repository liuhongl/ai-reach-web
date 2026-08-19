-- AI Reach 知识库最小权限。可重复执行。
-- 已有提示词管理权限的角色同时获得知识查看和管理权限；其他角色不自动扩权。

start transaction;

set @knowledge_parent_id := coalesce((
    select parent_id
    from sys_menu
    where perms = 'ai_call:prompt:manage'
    order by menu_id
    limit 1
), 0);

set @knowledge_view_id := (
    select menu_id
    from sys_menu
    where perms = 'ai_call:knowledge:view'
    order by menu_id
    limit 1
);
set @knowledge_view_id := coalesce(
    @knowledge_view_id,
    (select coalesce(max(menu_id), 0) + 1 from sys_menu)
);

insert into sys_menu (
    menu_id, menu_name, parent_id, order_num, path, component, query_param,
    is_frame, is_cache, menu_type, visible, status, perms, icon,
    create_dept, create_by, create_time, remark
)
select
    @knowledge_view_id, '知识库查看', @knowledge_parent_id, 1, '#', '', '',
    '1', '0', 'F', '1', '0', 'ai_call:knowledge:view', '#',
    103, 1, now(), 'AI Reach 知识库只读权限'
where not exists (
    select 1 from sys_menu where perms = 'ai_call:knowledge:view'
);

set @knowledge_manage_id := (
    select menu_id
    from sys_menu
    where perms = 'ai_call:knowledge:manage'
    order by menu_id
    limit 1
);
set @knowledge_manage_id := coalesce(
    @knowledge_manage_id,
    (select coalesce(max(menu_id), 0) + 1 from sys_menu)
);

insert into sys_menu (
    menu_id, menu_name, parent_id, order_num, path, component, query_param,
    is_frame, is_cache, menu_type, visible, status, perms, icon,
    create_dept, create_by, create_time, remark
)
select
    @knowledge_manage_id, '知识库管理', @knowledge_parent_id, 2, '#', '', '',
    '1', '0', 'F', '1', '0', 'ai_call:knowledge:manage', '#',
    103, 1, now(), 'AI Reach 知识库写入和场景绑定权限'
where not exists (
    select 1 from sys_menu where perms = 'ai_call:knowledge:manage'
);

insert ignore into sys_role_menu (role_id, menu_id)
select distinct role.role_id, permission.menu_id
from sys_role role
join sys_role_menu existing_role_menu on existing_role_menu.role_id = role.role_id
join sys_menu existing_permission
    on existing_permission.menu_id = existing_role_menu.menu_id
   and existing_permission.perms = 'ai_call:prompt:manage'
join sys_menu permission
    on permission.perms in (
        'ai_call:knowledge:view',
        'ai_call:knowledge:manage'
    )
where role.status = '0'
  and role.del_flag = '0';

commit;
