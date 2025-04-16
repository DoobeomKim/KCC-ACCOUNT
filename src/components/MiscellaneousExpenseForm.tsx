'use client'

import { useTranslations } from 'next-intl'
import { format as dateFormat } from 'date-fns'
import { CalendarIcon, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from '@/lib/utils'
import CountrySelector from '@/components/CountrySelector'
import { GermanNumberInput } from '@/components/ui/german-number-input'
import { ExpenseFormMiscellaneous } from '@/types/expense'

interface MiscellaneousExpenseFormProps {
  items: ExpenseFormMiscellaneous[]
  onAdd: () => void
  onUpdate: (index: number, field: string, value: any) => void
  onRemove: (index: number) => void
  onToggle: (index: number) => void
  tripStartDate?: string
  tripEndDate?: string
}

export default function MiscellaneousExpenseForm({ items, onAdd, onUpdate, onRemove, onToggle, tripStartDate, tripEndDate }: MiscellaneousExpenseFormProps) {
  const t = useTranslations()

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{t('expense.miscellaneous.title')}</h2>
        <Button
          onClick={onAdd}
          variant="outline"
          size="sm"
          className="h-10 px-4"
        >
          {t('expense.miscellaneous.addButton')}
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <Card key={index}>
            <CardContent className="pt-2">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">
                      {t("expense.miscellaneous.item", { number: index + 1 })}
                    </p>
                    {!item.isExpanded && (
                      <div className="flex gap-2 text-sm text-muted-foreground">
                        {item.date && (
                          <span>{dateFormat(new Date(item.date), "yy-MM-dd")}</span>
                        )}
                        {item.type && (
                          <>
                            <span>|</span>
                            <span>{item.type}</span>
                          </>
                        )}
                        {item.paidBy && (
                          <>
                            <span>|</span>
                            <span>
                              {item.paidBy === 'company' ? t("expense.paidBy.company") : t("expense.paidBy.personal")}
                            </span>
                          </>
                        )}
                        {item.totalAmount && (
                          <>
                            <span>|</span>
                            <span>{item.totalAmount.replace('.', ',')}€</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onToggle(index)}
                      className="h-10 w-10 rounded-full"
                    >
                      {item.isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onRemove(index)}
                      className="h-10 w-10 rounded-full text-red-500"
                      aria-label={t("expense.miscellaneous.deleteButton")}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                {item.isExpanded && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("expense.miscellaneous.date.label")}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !item.date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {item.date ? (
                                typeof item.date === 'string' ? 
                                  dateFormat(new Date(item.date), "PPP") : 
                                  dateFormat(item.date, "PPP")
                              ) : (
                                <span>{t("expense.miscellaneous.date.placeholder")}</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={item.date}
                              onDayClick={(day) => onUpdate(index, 'date', day)}
                              disabled={(date) => {
                                if (!tripStartDate || !tripEndDate) return true;
                                const startDate = new Date(tripStartDate);
                                startDate.setHours(0, 0, 0, 0);
                                const endDate = new Date(tripEndDate);
                                endDate.setHours(23, 59, 59, 999);
                                return date < startDate || date > endDate;
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("expense.miscellaneous.type.label")}</Label>
                        <Input
                          value={item.type}
                          onChange={(e) => onUpdate(index, 'type', e.target.value)}
                          placeholder={t("expense.miscellaneous.type.placeholder")}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("expense.miscellaneous.country.label")}</Label>
                        <Select
                          value={item.country}
                          onValueChange={(value) => onUpdate(index, 'country', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("expense.miscellaneous.country.placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DE">독일</SelectItem>
                            <SelectItem value="other">기타</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("expense.miscellaneous.companyName.label")}</Label>
                        <Input
                          value={item.companyName}
                          onChange={(e) => onUpdate(index, 'companyName', e.target.value)}
                          placeholder={t("expense.miscellaneous.companyName.placeholder")}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label>{t("expense.paidBy.label")}</Label>
                        <Select
                          value={item.paidBy}
                          onValueChange={(value) => onUpdate(index, 'paidBy', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("expense.paidBy.placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="company">{t("expense.paidBy.company")}</SelectItem>
                            <SelectItem value="personal">{t("expense.paidBy.personal")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{t("expense.miscellaneous.vat.label")}</Label>
                        <div className="relative">
                          <GermanNumberInput
                            value={item.vat}
                            onChange={(value) => onUpdate(index, 'vat', String(value))}
                            placeholder={t("expense.miscellaneous.vat.placeholder")}
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2">€</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("expense.miscellaneous.totalAmount.label")}</Label>
                      <div className="relative">
                        <GermanNumberInput
                          value={item.totalAmount}
                          onChange={(value) => onUpdate(index, 'totalAmount', String(value))}
                          placeholder={t("expense.miscellaneous.totalAmount.placeholder")}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">€</span>
                      </div>
                    </div>
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onToggle(index)}
                        className="w-full"
                      >
                        <ChevronUp className="h-4 w-4 mr-2" />
                        창 닫기
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 