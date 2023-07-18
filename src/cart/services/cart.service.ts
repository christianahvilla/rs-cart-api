import { v4 } from 'uuid';
import { Injectable } from '@nestjs/common';

import type { Cart } from '../models';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CartService {
  private userCarts: Record<string, Cart> = {};
  private client = null;

  constructor() {
    this.client = new Client({
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      user: process.env.PG_USER,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
    });

    this.client.connect();
  }

  // constructor(
  //   @InjectRepository(Cart)
  //   private readonly datasource: DataSource,
  // ) {}

  async findByUserId(userId: string): Promise<Cart> {
    const userCart = {
      id: '',
      items: [],
    };
    const query = {
      text: 'select ca.id, ci.cart_id, ci.product_id, ci.count  from carts ca inner join cart_items ci on ca.id = ci.cart_id where user_id = $1',
      values: [userId],
    };

    try {
      const { rows } = await this.client.query(query);

      if (!rows.length) {
        return;
      }

      let items = [];
      for (let i = 0; i < rows.length; i++) {
        items.push({
          product_id: rows[i].product_id,
          count: rows[i].count,
        });
      }

      userCart.id = rows[0].id;
      userCart.items = items;

      this.userCarts[userId] = userCart;

      return this.userCarts[userId];
    } catch (error) {
      console.error(error);
    }

    return;
  }

  async createByUserId(userId: string) {
    const text =
      'insert into carts(id, user_id, created_at, updated_at, status) values($1, $2, $3, $4, $5)';
    const values = [v4(v4()), v4(v4()), new Date(), new Date(), 'OPEN'];

    try {
      const { rows } = await this.client.query(text, values);

      if (!rows.length) return;

      const userCart = {
        id: rows[0].id,
        items: [],
      };

      this.userCarts[userId] = userCart;

      return userCart;
    } catch (error) {
      console.log(error);
    }

    return {
      id: '',
      items: [],
    };
  }

  async findOrCreateByUserId(userId: string): Promise<Cart> {
    const userCart = await this.findByUserId(userId);

    if (userCart) {
      return userCart;
    }

    return this.createByUserId(userId);
  }

  async updateByUserId(userId: string, { items }: Cart): Promise<Cart> {
    const cartByUser = await this.findByUserId(userId);

    for (let item of items) {
      const text =
        'update cart_items set product_id=$1, count=$2 where cart_id=$3';
      const values = [item.product.id, item.count, cartByUser.id];

      this.client.query(text, values, (err, res) => {
        if (err) {
          console.log(err);

          return;
        }

        const updatedCart = {
          id: res.id,
          items: [...items],
        };

        this.userCarts[userId] = { ...updatedCart };

        return { ...updatedCart };
      });

      return;
    }
  }

  async removeByUserId(userId): Promise<void> {
    const text = 'delete from carts where user_id = $1';
    const values = [userId];

    try {
      await this.client.query(text, values);

      this.userCarts[userId] = null;
    } catch (error) {
      console.error(error);
    }
  }
}
