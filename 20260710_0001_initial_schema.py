"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-10 00:00:01

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    admin_role = postgresql.ENUM(
        "owner", "admin", "moderator", "viewer", name="admin_role"
    )
    moderation_action_type = postgresql.ENUM(
        "mute", "unmute", "ban", "unban", "kick", "warn", "unwarn",
        "clear", "delete_message", "auto_antispam", "auto_antiflood",
        name="moderation_action_type",
    )
    audit_event_type = postgresql.ENUM(
        "login_code_requested", "login_success", "login_failed", "logout", "admin_added",
        "admin_removed", "admin_role_changed", "group_added", "group_removed",
        "settings_changed", "broadcast_sent", "moderation", "error",
        name="audit_event_type",
    )
    broadcast_content_type = postgresql.ENUM(
        "text", "photo", "video", "document", "animation", name="broadcast_content_type"
    )
    broadcast_status = postgresql.ENUM(
        "draft", "queued", "sending", "completed", "failed", name="broadcast_status"
    )

    bind = op.get_bind()
    admin_role.create(bind, checkfirst=True)
    moderation_action_type.create(bind, checkfirst=True)
    audit_event_type.create(bind, checkfirst=True)
    broadcast_content_type.create(bind, checkfirst=True)
    broadcast_status.create(bind, checkfirst=True)

    # --- admins ---
    op.create_table(
        "admins",
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("role", admin_role, nullable=False),
        sa.Column("is_root", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("added_by", sa.BigInteger(), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["added_by"], ["admins.telegram_id"],
                                 name="fk_admins_added_by_admins", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("telegram_id", name="pk_admins"),
    )

    # --- groups ---
    op.create_table(
        "groups",
        sa.Column("chat_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=True),
        sa.Column("added_by", sa.BigInteger(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("members_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["added_by"], ["admins.telegram_id"],
                                 name="fk_groups_added_by_admins", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("chat_id", name="pk_groups"),
    )

    # --- group_settings ---
    op.create_table(
        "group_settings",
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("mute_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("warn_limit", sa.Integer(), nullable=False),
        sa.Column("flood_limit", sa.Integer(), nullable=False),
        sa.Column("flood_window_seconds", sa.Integer(), nullable=False),
        sa.Column("auto_delete_service_messages", sa.Boolean(), nullable=False),
        sa.Column("antispam_enabled", sa.Boolean(), nullable=False),
        sa.Column("antiflood_enabled", sa.Boolean(), nullable=False),
        sa.Column("logs_enabled", sa.Boolean(), nullable=False),
        sa.Column("notifications_enabled", sa.Boolean(), nullable=False),
        sa.Column("language", sa.String(length=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.chat_id"],
                                 name="fk_group_settings_group_id_groups", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", name="pk_group_settings"),
    )

    # --- users ---
    op.create_table(
        "users",
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=True),
        sa.Column("first_name", sa.String(length=255), nullable=True),
        sa.Column("last_name", sa.String(length=255), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_globally_banned", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("telegram_id", name="pk_users"),
    )
    op.create_index("ix_users_username", "users", ["username"])

    # --- user_group_stats ---
    op.create_table(
        "user_group_stats",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("warns_count", sa.Integer(), nullable=False),
        sa.Column("messages_count", sa.Integer(), nullable=False),
        sa.Column("deleted_messages_count", sa.Integer(), nullable=False),
        sa.Column("is_muted", sa.Boolean(), nullable=False),
        sa.Column("muted_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_banned", sa.Boolean(), nullable=False),
        sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.telegram_id"],
                                 name="fk_user_group_stats_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.chat_id"],
                                 name="fk_user_group_stats_group_id_groups", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "group_id", name="pk_user_group_stats"),
    )

    # --- moderation_actions ---
    op.create_table(
        "moderation_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("target_user_id", sa.BigInteger(), nullable=False),
        sa.Column("admin_id", sa.BigInteger(), nullable=True),
        sa.Column("action_type", moderation_action_type, nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.chat_id"],
                                 name="fk_moderation_actions_group_id_groups", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.telegram_id"],
                                 name="fk_moderation_actions_target_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_moderation_actions"),
    )
    op.create_index("ix_moderation_actions_group_id", "moderation_actions", ["group_id"])
    op.create_index("ix_moderation_actions_target_user_id", "moderation_actions", ["target_user_id"])
    op.create_index("ix_moderation_actions_action_type", "moderation_actions", ["action_type"])

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_type", audit_event_type, nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["admins.telegram_id"],
                                 name="fk_audit_logs_actor_id_admins", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
    )
    op.create_index("ix_audit_logs_event_type", "audit_logs", ["event_type"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])

    # --- auth_codes ---
    op.create_table(
        "auth_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("encrypted_code", sa.String(length=512), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["telegram_id"], ["admins.telegram_id"],
                                 name="fk_auth_codes_telegram_id_admins", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_auth_codes"),
    )
    op.create_index("ix_auth_codes_telegram_id", "auth_codes", ["telegram_id"])

    # --- broadcasts ---
    op.create_table(
        "broadcasts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("content_type", broadcast_content_type, nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("file_id", sa.String(length=255), nullable=True),
        sa.Column("buttons", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", broadcast_status, nullable=False),
        sa.Column("target_count", sa.Integer(), nullable=False),
        sa.Column("sent_count", sa.Integer(), nullable=False),
        sa.Column("failed_count", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_broadcasts"),
    )


def downgrade() -> None:
    op.drop_table("broadcasts")
    op.drop_table("auth_codes")
    op.drop_index("ix_audit_logs_actor_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_event_type", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_moderation_actions_action_type", table_name="moderation_actions")
    op.drop_index("ix_moderation_actions_target_user_id", table_name="moderation_actions")
    op.drop_index("ix_moderation_actions_group_id", table_name="moderation_actions")
    op.drop_table("moderation_actions")
    op.drop_table("user_group_stats")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
    op.drop_table("group_settings")
    op.drop_table("groups")
    op.drop_table("admins")

    bind = op.get_bind()
    postgresql.ENUM(name="broadcast_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="broadcast_content_type").drop(bind, checkfirst=True)
    postgresql.ENUM(name="audit_event_type").drop(bind, checkfirst=True)
    postgresql.ENUM(name="moderation_action_type").drop(bind, checkfirst=True)
    postgresql.ENUM(name="admin_role").drop(bind, checkfirst=True)
