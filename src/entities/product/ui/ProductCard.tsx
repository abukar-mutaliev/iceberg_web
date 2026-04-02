import { useState } from 'react';
import { Tag, Typography } from 'antd';
import { buildImageUrl } from '@/shared/lib';
import type { Product } from '../model/types';
import { getProductDisplayPrices } from '../model/display-prices';

interface ProductCardProps {
  product: Product;
  onClick?: (product: Product) => void;
  /** SUPPLIER: показывать supplierProposed* до модерации */
  viewerRole?: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  APPROVED: { color: '#10b981', label: 'Одобрен' },
  PENDING: { color: '#f59e0b', label: 'На проверке' },
  REJECTED: { color: '#ef4444', label: 'Отклонён' },
};

export function ProductCard({ product, onClick, viewerRole }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);

  const imageSrc = product.images?.[0] ? buildImageUrl(product.images[0]) : null;
  const hasImage = Boolean(imageSrc) && !imgError;

  const { unitPrice, boxPrice: displayBoxPrice } = getProductDisplayPrices(product, { viewerRole });
  const price =
    typeof unitPrice === 'number'
      ? `${unitPrice.toLocaleString('ru-RU')} ₽`
      : '—';

  const stock =
    typeof product.stockQuantity === 'number'
      ? `${product.stockQuantity.toLocaleString('ru-RU')} шт.`
      : '—';

  const modStatus = product.moderationStatus ? STATUS_CONFIG[product.moderationStatus] : null;

  return (
    <div
      onClick={() => onClick?.(product)}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.22s ease, transform 0.22s ease',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Image */}
      <div
        style={{
          position: 'relative',
          height: 180,
          background: hasImage ? '#000' : 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {hasImage ? (
          <img
            src={imageSrc!}
            alt={product.name}
            onError={() => {
              console.error('[ProductCard] Image failed to load:', imageSrc);
              setImgError(true);
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.9,
              transition: 'opacity 0.2s',
            }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <Typography.Text style={{ color: '#94a3b8', fontSize: 12 }}>Нет изображения</Typography.Text>
          </div>
        )}

        {/* Active status overlay */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: product.isActive ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 20,
            backdropFilter: 'blur(4px)',
            letterSpacing: 0.3,
          }}
        >
          {product.isActive ? 'Активен' : 'Неактивен'}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <Typography.Text
          strong
          ellipsis={{ tooltip: product.name }}
          style={{ fontSize: 14, lineHeight: 1.4, color: '#1e293b' }}
        >
          {product.name}
        </Typography.Text>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text style={{ color: '#64748b', fontSize: 12 }}>Цена</Typography.Text>
            <Typography.Text strong style={{ color: '#0f172a', fontSize: 15 }}>
              {price}
            </Typography.Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text style={{ color: '#64748b', fontSize: 12 }}>Остаток</Typography.Text>
            <Typography.Text style={{ color: '#334155', fontSize: 13 }}>{stock}</Typography.Text>
          </div>

          {displayBoxPrice != null && product.itemsPerBox && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Text style={{ color: '#64748b', fontSize: 12 }}>Коробка ({product.itemsPerBox} шт.)</Typography.Text>
              <Typography.Text style={{ color: '#334155', fontSize: 13 }}>
                {displayBoxPrice.toLocaleString('ru-RU')} ₽
              </Typography.Text>
            </div>
          )}
        </div>

        {/* Categories and moderation status */}
        {(product.categories?.length || modStatus) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
            {modStatus && (
              <Tag
                style={{
                  background: `${modStatus.color}18`,
                  color: modStatus.color,
                  border: `1px solid ${modStatus.color}40`,
                  borderRadius: 6,
                  fontSize: 11,
                  padding: '1px 7px',
                  fontWeight: 500,
                }}
              >
                {modStatus.label}
              </Tag>
            )}
            {product.categories?.slice(0, 2).map((cat) => (
              <Tag
                key={cat.id}
                style={{
                  background: '#f1f5f9',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 11,
                  padding: '1px 7px',
                }}
              >
                {cat.name}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
